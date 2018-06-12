var languageclient = require('./lsp/languageclient');
const gaugeDaemon = require('./lsp/gauge');
var _user = require('./user')
var fileExtension = require('./util/fileExtension');
var path = require('path');
var customLogPath;
var projectPath
step("create Project in temporary directory <relativePath>", async function(relativePath,done) {
    projectPath = await _user.createProjectInTemp(relativePath,done)
    process.env.logs_directory = path.relative(projectPath,'logs')+"/lsp-tests/"+customLogPath;
});

step("pre-requisite <relativePath>", async function(relativePath) {
    languageclient.prerequisite(projectPath,process.env.language);
});

step("open the project", async function () {
    try{
        await languageclient.openProject();
    }
    catch(err){
        console.log(err.stack)
        gauge.message(err.stack)

        throw new Error("unable to start gauge daemon "+err)
    }
});

beforeScenario(async function(context){
    customLogPath = context.currentSpec.name+"/"+context.currentScenario.name;
})

afterScenario(async function () {
    try{
        await languageclient.shutDown()
    }catch(err){
        console.log(err.stack)
        gauge.message(err.stack)

        throw new Error("trying to stop gauge daemon failed "+err)
    }
});

step("initialize using the initialize template", async function() {
    var runner = (process.env.language=='javascript')?'js':process.env.language
    var resourcePath = path.join('./resources',runner)
    if(fileExtension.createDirIfNotPresent(resourcePath))
        gaugeDaemon.initializeWithTemplate(resourcePath, runner); 
});

step("copy template init from cache", async function(cb) {
    var runner = (process.env.language=='javascript')?'js':process.env.language
    var resourcePath = path.join('./resources',runner)
    _user.copyDataToDir(resourcePath,projectPath,cb)
});