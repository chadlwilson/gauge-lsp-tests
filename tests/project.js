var languageclient = require('./lsp/languageclient');

step("pre-requisite <relativePath>", async function(relativePath) {
	await languageclient.prerequisite(relativePath,process.env.language)
});

step('open the project <relativePath>', async function (relativePath) {
    try{
        await languageclient.openProject(relativePath,process.env.language);        
    }
    catch(err){
        throw new Error("unable to start gauge daemon "+err)
    }    
});

step('open project with full path <fullPath>', async function (fullPath) {
    try{        
        await languageclient.openProject(fullPath,null);
    }
    catch(err){
        throw new Error("unable to start gauge daemon "+err)
    }    
});

step("stop gauge daemon", async function() {
	try{
        await languageclient.shutDown()
    }catch(err){
        throw new Error("trying to stop gauge daemon failed "+err)
    }
});