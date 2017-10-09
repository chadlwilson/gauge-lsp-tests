"use strict";

var assert = require('assert');
//const rpc = require('vscode-jsonrpc');

//var daemon = require('./lsp/daemon');
var notification = require('./lsp/notifications/notification');
var request = require('./lsp/requests/request');

var table = require('./util/table');
var scenarioStore = gauge.dataStore.scenarioStore;
var expectedSteps = [];
var responseType = {
  Function: 3,
  Variable: 4
}

const { spawn } = require('child_process');
const rpc = require('vscode-jsonrpc');
var assert = require('assert');

var cwd = process.cwd();

async function startGaugeDaemon(store,projectPath){    
    var absProjectPath = cwd+projectPath;    
    const gauge_daemon = spawn('gauge', ['daemon', '--lsp',"--dir="+absProjectPath]);
    var reader = new rpc.StreamMessageReader(gauge_daemon.stdout);
    var writer = new rpc.StreamMessageWriter(gauge_daemon.stdin);

    assert.ok(gauge_daemon.connected,"gauge daemon should be connected")

    let connection = rpc.createMessageConnection(reader,writer);
    connection.listen();

    var uri = absProjectPath.replace(":","%3A")
    store.put("connection", connection);
    store.put("reader",reader);    
    store.put("projectUri", uri);

    console.log(absProjectPath)
};

step("open file <filePath> <contents>",async function(filePath,contents){  
  var content = table.tableToArray(contents).join("\n")
  await notification.openFile(
    {
      path:filePath,
      content:content
    },scenarioStore)
});

step("autocomplete at line <lineNumber> character <characterNumber> should give parameters <expectedResult>",async function(lineNumber,characterNumber,expectedResult){  
  expectedParameters = table.tableToArray(expectedResult)
  var position = {
    lineNumber:lineNumber,
    characterNumber:characterNumber
  }
  await request.autocomplete(position,
    scenarioStore,
    handleParameterResponse);
});

step("autocomplete at line <lineNumber> character <characterNumber> should give steps <expectedResult>",async function(lineNumber,characterNumber,expectedResult){  
  expectedSteps = table.tableToArray(expectedResult)
  
  var position = {
    lineNumber:lineNumber,
    characterNumber:characterNumber
  }
  await request.autocomplete(position,
    scenarioStore,
    handleStepsResponse);
});

step("start gauge daemon for project <relativePath>",async function(relativePath){
  var gauge_daemon = await startGaugeDaemon(scenarioStore,relativePath);
});

function handleStepsResponse(responseMessage){    
  if(responseMessage.result){
    for(var index=0; index< responseMessage.result.items.length;index++){
      var item = responseMessage.result.items[index]
      
      if(item.kind!=responseType.Function)
        continue    
      assert.equal(item.kind,responseType.Function);      
      assert.ok(expectedSteps.indexOf(item.label)>-1,JSON.stringify(item))
    }  
  }
}

function handleParameterResponse(responseMessage){  
  if(responseMessage.result){
    for(var index=0; index< responseMessage.result.items.length;index++){      
      var item = responseMessage.result.items[index]
      if(item.kind!=responseType.Variable)
        continue
      assert.ok(expectedParameters.indexOf(item.label)>-1,"item label not found "+item.label)
    }  
  }
}