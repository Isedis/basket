// The current recovery entry is Windows CMD + Electron Node, with a native GUI helper.
if(process.platform!=='win32'){console.log('SKIP Windows CMD migration: run scripts/native-update-smoke.cjs on Windows with OPORA_TEST_UPDATE_MODE=migration.');}
else{process.env.OPORA_TEST_UPDATE_MODE='migration';require('./native-update-smoke.cjs');}
