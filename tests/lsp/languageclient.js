"use strict";
const vscodeUri = require("vscode-uri").URI;
const file = require("../util/fileExtension");
const _runner = require("./runner");
const _lspServer = require("./gauge");
var path = require("path");
const _request = require("./rpc/request");
const _notification = require("./rpc/notification");
const _connection = require("./rpc/connection");
var builder = require("./util/dataBuilder");
var state = {};
var listeners = [];
var listenerId = 0;

async function shutDown() {
  await _request.sendRequest(state.connection, "shutdown", undefined);
  _notification.sendNotification(state.connection, "exit");
}

function getRange(position){
  return {
    "line": parseInt(position.line),
    "character": parseInt(position.character)        
  };
}

function getMessageParams(fileUri,keyValues) {
  if(keyValues==null)
    return null;
  var messageParams = {};
  for (const element of Object.keys(keyValues)) {
    messageParams[element] = (keyValues[element]);
  }

  messageParams.textDocument = {
    "uri": vscodeUri.file(fileUri).toString().replace("%25","%")
  };

  return messageParams;
}

function codeAction(fileUri,range,diagnostics) {
  return _request.sendRequest(state.connection,"textDocument/codeAction",getMessageParams(filePath(fileUri),
    {"range":range,"context":{"diagnostics":diagnostics}}
  ));
}

function codeLens(fileUri) {
  return _request.sendRequest(state.connection, "textDocument/codeLens",getMessageParams(filePath(fileUri),{}));
}

function codeComplete(position, relativeFilePath) {
  return _request.sendRequest(state.connection, "textDocument/completion",getMessageParams(filePath(relativeFilePath),{"position":getRange(position),"context":{"triggerKind":1}}));
}

function gotoDefinition(position, relativeFilePath) {
  return _request.sendRequest(state.connection, "textDocument/definition",getMessageParams(filePath(relativeFilePath),{"position":getRange(position)}));
}

function workspaceSymbol(params) {
  return _request.sendRequest(state.connection, "workspace/symbol", params);
}

function documentSymbol(relativeFilePath) {
  return _request.sendRequest(state.connection, "textDocument/documentSymbol",getMessageParams(filePath(relativeFilePath),{}));
}

function formatFile(relativeFilePath) {
  return _request.sendRequest(state.connection, "textDocument/formatting",getMessageParams(filePath(relativeFilePath),{"options":{
    "tabSize": 4,
    "insertSpaces": true
  }}));
}

function filePath(relativePath) {
  return path.join(projectPath(), builder.updateSpecsDir(relativePath));
}

function projectPath() {
  if (!state.projectPath)
    throw (Error("Project path not set"));
  return state.projectPath;
}

function prerequisite(gaugeProjectPath, runner) {
  state.projectPath = file.getFSPath(gaugeProjectPath);
  _runner.copyManifest(gaugeProjectPath, runner);
  _runner.prerequisite(gaugeProjectPath,runner);
}

function refactor(uri, position, newName) {
  return _request.sendRequest(state.connection, "textDocument/rename", {
    "textDocument": { "uri": file.getUri(filePath(uri)) },
    "position": getRange(position),
    "newName": newName
  });
}

function openProject() {
  state.gaugeDaemon = _lspServer.startLSP(state.projectPath);
  return initialize(state.gaugeDaemon, state.projectPath);
}

function verificationFailures() {
  return state.logger.getErrorMessage();
}

function sendRequest(method, params) {
  return _request.sendRequest(state.connection, method, params);
}


function saveFile(relativePath) {
  _notification.sendNotification(state.connection, "textDocument/didSave",
    {
      "textDocument":
                {
                  "uri": file.getUri(filePath(relativePath))
                }
    });
}


function editFile(relativePath, contentFile) {
  if (contentFile == null)
    contentFile = relativePath;

  state.connection.onNotification("textDocument/publishDiagnostics", () => { /* Empty */ });

  _notification.sendNotification(state.connection, "textDocument/didChange",
    {
      "textDocument":
                {
                  "uri": file.getUri(filePath(relativePath))
                },
      "contentChanges": [{
        "text": file.parseContent(filePath(contentFile)),
      }]
    });
}

function openFile(relativePath, contentFile) {
  if (contentFile == null)
    contentFile = relativePath;

  state.connection.onNotification("textDocument/publishDiagnostics", () => { /* Empty */});
  _notification.sendNotification(state.connection, "textDocument/didOpen",
    {
      "textDocument":
                {
                  "uri": file.getUri(filePath(relativePath)),
                  "languageId": "markdown",
                  "version": 1,
                  "text": file.parseContent(filePath(contentFile))
                }
    });
}

async function initialize(gaugeProcess, execPath) {
  var result = _connection.newConnection(gaugeProcess);
  var connection = result.connection;
  state.logger = result.logger;

  const initializeParams = getInitializeParams(execPath, gaugeProcess);

  connection.onNotification("window/logMessage", (message) => {
    console.log(JSON.stringify(message));
  });

  connection.onError((e) => {
    console.log(JSON.stringify(e));
  });

  await _request.sendRequest(connection, "initialize", initializeParams, null);
  _notification.sendNotification(connection, "initialized", {});

  var expectedCapabilityIds = ["gauge-fileWatcher", "gauge-runner-didOpen", "gauge-runner-didClose", "gauge-runner-didChange", "gauge-runner-didChange", "gauge-runner-fileWatcher"];
  var registerCapabilityPromise = new Promise(function (resolve) {
    _request.onRequest(connection, "client/registerCapability", async (data) => {
      data.registrations.forEach(registration => {
        expectedCapabilityIds = expectedCapabilityIds.filter(id => registration.id !== id);
      });
      if (expectedCapabilityIds.length == 0) {
        resolve();
      }
    });
  });

  if (listeners != null && listeners.length > 0)
    _notification.OnNotification("textDocument/publishDiagnostics", connection, listeners);

  state.connection = connection;
  return registerCapabilityPromise;
}

// Return the parameters used to initialize a client - you may want to extend capabilities
function getInitializeParams(gaugeProjectPath, process) {
  return {
    processId: process.pid,
    rootPath: gaugeProjectPath,
    rootUri: vscodeUri.file(gaugeProjectPath).toString(),
    capabilities: {
      workspace: {
        applyEdit: true,
        didChangeConfiguration: { dynamicRegistration: true },
        didChangeWatchedFiles: { dynamicRegistration: true },
        symbol: { dynamicRegistration: true },
        executeCommand: { dynamicRegistration: true }
      },
      textDocument: {
        synchronization: { dynamicRegistration: true, willSave: true, willSaveWaitUntil: true, didSave: true },
        completion: { dynamicRegistration: true, completionItem: { snippetSupport: true, commitCharactersSupport: true } },
        hover: { dynamicRegistration: true }, signatureHelp: { dynamicRegistration: true },
        definition: { dynamicRegistration: true },
        references: { dynamicRegistration: true },
        documentHighlight: { dynamicRegistration: true }, documentSymbol: { dynamicRegistration: true },
        codeAction: { dynamicRegistration: true },
        codeLens: { dynamicRegistration: true },
        formatting: { dynamicRegistration: true },
        rangeFormatting: { dynamicRegistration: true },
        onTypeFormatting: { dynamicRegistration: true },
        rename: { dynamicRegistration: true },
        documentLink: { dynamicRegistration: true }
      }
    },
    trace: "off",
    experimental: {}
  };
}

function registerForNotification(listener, expectedDiagnostics, verifyIfDone, done) {
  var id = listenerId;
  listeners.push({ id: listenerId, listener: listener, expectedDiagnostics: expectedDiagnostics, verifyIfDone: verifyIfDone, done: done });
  listenerId++;
  return id;
}

module.exports = {
  openProject: openProject,
  registerForNotification: registerForNotification,
  shutDown: shutDown,
  openFile: openFile,
  editFile: editFile,
  saveFile: saveFile,
  codeAction:codeAction,
  codeLens: codeLens,
  codeComplete:codeComplete,
  gotoDefinition: gotoDefinition,
  formatFile: formatFile,
  filePath: filePath,
  projectPath: projectPath,
  verificationFailures: verificationFailures,
  prerequisite: prerequisite,
  refactor: refactor,
  sendRequest: sendRequest,
  documentSymbol: documentSymbol,
  workspaceSymbol: workspaceSymbol
};
