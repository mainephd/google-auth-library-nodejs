"use strict";
/**
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const child_process = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const gcp_metadata_1 = require("gcp-metadata");
const nock = require("nock");
const path = require("path");
const sinon = require("sinon");
const assertRejects = require('assert-rejects');
const src_1 = require("../src");
const envDetect = require("../src/auth/envDetect");
const googleauth_1 = require("../src/auth/googleauth");
const messages = require("../src/messages");
nock.disableNetConnect();
const tokenPath = `${gcp_metadata_1.BASE_PATH}/instance/service-accounts/default/token`;
const host = gcp_metadata_1.HOST_ADDRESS;
const instancePath = `${gcp_metadata_1.BASE_PATH}/instance`;
const svcAccountPath = `${instancePath}/service-accounts/?recursive=true`;
const API_KEY = 'test-123';
const STUB_PROJECT = 'my-awesome-project';
const ENDPOINT = '/events:report';
const RESPONSE_BODY = 'RESPONSE_BODY';
const BASE_URL = [
    'https://clouderrorreporting.googleapis.com/v1beta1/projects', STUB_PROJECT
].join('/');
const privateJSON = require('../../test/fixtures/private.json');
const private2JSON = require('../../test/fixtures/private2.json');
const refreshJSON = require('../../test/fixtures/refresh.json');
const fixedProjectId = 'my-awesome-project';
const privateKey = fs.readFileSync('./test/fixtures/private.pem', 'utf-8');
let auth;
let sandbox;
beforeEach(() => {
    auth = new src_1.GoogleAuth();
    sandbox = sinon.createSandbox();
});
afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
});
function nockIsGCE() {
    return nock(host).get(instancePath).reply(200, {}, gcp_metadata_1.HEADERS);
}
function nockNotGCE() {
    return nock(host).get(instancePath).replyWithError({ code: 'ENOTFOUND' });
}
function nock500GCE() {
    return nock(host).get(instancePath).reply(500);
}
function nock404GCE() {
    return nock(host).get(instancePath).reply(404);
}
function createGetProjectIdNock(projectId) {
    return nock(host)
        .get(`${gcp_metadata_1.BASE_PATH}/project/project-id`)
        .reply(200, projectId, gcp_metadata_1.HEADERS);
}
// Creates a standard JSON auth object for testing.
function createJwtJSON() {
    return {
        private_key_id: 'key123',
        private_key: 'privatekey',
        client_email: 'hello@youarecool.com',
        client_id: 'client123',
        type: 'service_account'
    };
}
// Pretend that we're GCE, and mock an access token.
function mockGCE() {
    const scope1 = nockIsGCE();
    blockGoogleApplicationCredentialEnvironmentVariable();
    const auth = new src_1.GoogleAuth();
    auth._fileExists = () => false;
    const scope2 = nock(gcp_metadata_1.HOST_ADDRESS)
        .get(tokenPath)
        .reply(200, { access_token: 'abc123', expires_in: 10000 }, gcp_metadata_1.HEADERS);
    return { auth, scopes: [scope1, scope2] };
}
// Matches the ending of a string.
function stringEndsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
// Simulates a path join.
function pathJoin(item1, item2) {
    return item1 + ':' + item2;
}
// Blocks the GOOGLE_APPLICATION_CREDENTIALS by default. This is necessary in
// case it is actually set on the host machine executing the test.
function blockGoogleApplicationCredentialEnvironmentVariable() {
    return mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS');
}
// Intercepts the specified environment variable, returning the specified value.
function mockEnvVar(name, value = '') {
    const envVars = Object.assign({}, process.env, { [name]: value });
    const stub = sandbox.stub(process, 'env').value(envVars);
    return stub;
}
// Intercepts the specified file path and inserts the mock file path.
function insertWellKnownFilePathIntoAuth(auth, filePath, mockFilePath) {
    const originalMockWellKnownFilePathFunction = auth._mockWellKnownFilePath;
    auth._mockWellKnownFilePath = (kfpath) => {
        if (kfpath === filePath) {
            return mockFilePath;
        }
        return originalMockWellKnownFilePathFunction(filePath);
    };
}
it('fromJSON should support the instantiated named export', () => {
    const result = auth.fromJSON(createJwtJSON());
    assert(result);
});
it('fromJson should error on null json', () => {
    const auth = new src_1.GoogleAuth();
    assert.throws(() => {
        // Test verifies invalid parameter tests, which requires cast to any.
        // tslint:disable-next-line no-any
        auth.fromJSON(null);
    });
});
it('fromAPIKey should error given an invalid api key', () => {
    assert.throws(() => {
        // Test verifies invalid parameter tests, which requires cast to any.
        // tslint:disable-next-line no-any
        auth.fromAPIKey(null);
    });
});
it('should make a request with the api key', () => __awaiter(this, void 0, void 0, function* () {
    const scope = nock(BASE_URL).post(ENDPOINT).query({ key: API_KEY }).reply(uri => {
        assert(uri.indexOf('key=' + API_KEY) > -1);
        return [200, RESPONSE_BODY];
    });
    const client = auth.fromAPIKey(API_KEY);
    const res = yield client.request({ url: BASE_URL + ENDPOINT, method: 'POST', data: { 'test': true } });
    assert.strictEqual(RESPONSE_BODY, res.data);
    scope.done();
}));
it('should make a request while preserving original parameters', () => __awaiter(this, void 0, void 0, function* () {
    const OTHER_QS_PARAM = { test: 'abc' };
    const scope = nock(BASE_URL)
        .post(ENDPOINT)
        .query({ test: OTHER_QS_PARAM.test, key: API_KEY })
        .reply(uri => {
        assert(uri.indexOf('key=' + API_KEY) > -1);
        assert(uri.indexOf('test=' + OTHER_QS_PARAM.test) > -1);
        return [200, RESPONSE_BODY];
    });
    const client = auth.fromAPIKey(API_KEY);
    const res = yield client.request({
        url: BASE_URL + ENDPOINT,
        method: 'POST',
        data: { 'test': true },
        params: OTHER_QS_PARAM
    });
    assert.strictEqual(RESPONSE_BODY, res.data);
    scope.done();
}));
it('should make client with eagerRetryThresholdMillis set', () => {
    const client = auth.fromAPIKey(API_KEY, { eagerRefreshThresholdMillis: 100 });
    assert.strictEqual(100, client.eagerRefreshThresholdMillis);
});
it('fromJSON should error on empty json', () => {
    const auth = new src_1.GoogleAuth();
    assert.throws(() => {
        auth.fromJSON({});
    });
});
it('fromJSON should error on missing client_email', () => {
    const json = createJwtJSON();
    delete json.client_email;
    assert.throws(() => {
        auth.fromJSON(json);
    });
});
it('fromJSON should error on missing private_key', () => {
    const json = createJwtJSON();
    delete json.private_key;
    assert.throws(() => {
        auth.fromJSON(json);
    });
});
it('fromJSON should create JWT with client_email', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(json.client_email, result.email);
});
it('fromJSON should create JWT with private_key', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(json.private_key, result.key);
});
it('fromJSON should create JWT with null scopes', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(undefined, result.scopes);
});
it('fromJSON should create JWT with null subject', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(undefined, result.subject);
});
it('fromJSON should create JWT with null keyFile', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(undefined, result.keyFile);
});
it('fromJSON should create JWT which eagerRefreshThresholdMillisset when this is set for GoogleAuth', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json, { eagerRefreshThresholdMillis: 5000 });
    assert.strictEqual(5000, result.eagerRefreshThresholdMillis);
});
it('fromJSON should create JWT with 5min as value for eagerRefreshThresholdMillis', () => {
    const json = createJwtJSON();
    const result = auth.fromJSON(json);
    assert.strictEqual(300000, result.eagerRefreshThresholdMillis);
});
it('fromStream should error on null stream', (done) => {
    // Test verifies invalid parameter tests, which requires cast to any.
    // tslint:disable-next-line no-any
    auth.fromStream(null, (err) => {
        assert.strictEqual(true, err instanceof Error);
        done();
    });
});
it('fromStream should read the stream and create a jwt', () => __awaiter(this, void 0, void 0, function* () {
    const stream = fs.createReadStream('./test/fixtures/private.json');
    // And pass it into the fromStream method.
    const res = yield auth.fromStream(stream);
    const jwt = res;
    // Ensure that the correct bits were pulled from the stream.
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
}));
it('fromStream should read the stream and create a jwt with eager refresh', () => __awaiter(this, void 0, void 0, function* () {
    const stream = fs.createReadStream('./test/fixtures/private.json');
    const auth = new src_1.GoogleAuth();
    const result = yield auth.fromStream(stream, { eagerRefreshThresholdMillis: 1000 * 60 * 60 });
    const jwt = result;
    // Ensure that the correct bits were pulled from the stream.
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
    assert.strictEqual(1000 * 60 * 60, jwt.eagerRefreshThresholdMillis);
}));
it('should read another stream and create a UserRefreshClient', () => __awaiter(this, void 0, void 0, function* () {
    const stream = fs.createReadStream('./test/fixtures/refresh.json');
    const auth = new src_1.GoogleAuth();
    const res = yield auth.fromStream(stream);
    // Ensure that the correct bits were pulled from the stream.
    const rc = res;
    assert.strictEqual(refreshJSON.client_id, rc._clientId);
    assert.strictEqual(refreshJSON.client_secret, rc._clientSecret);
    assert.strictEqual(refreshJSON.refresh_token, rc._refreshToken);
}));
it('should read another stream and create a UserRefreshClient with eager refresh', () => __awaiter(this, void 0, void 0, function* () {
    const stream = fs.createReadStream('./test/fixtures/refresh.json');
    const auth = new src_1.GoogleAuth();
    const result = yield auth.fromStream(stream, { eagerRefreshThresholdMillis: 100 });
    // Ensure that the correct bits were pulled from the stream.
    const rc = result;
    assert.strictEqual(refreshJSON.client_id, rc._clientId);
    assert.strictEqual(refreshJSON.client_secret, rc._clientSecret);
    assert.strictEqual(refreshJSON.refresh_token, rc._refreshToken);
    assert.strictEqual(100, rc.eagerRefreshThresholdMillis);
}));
it('getApplicationCredentialsFromFilePath should not error on valid symlink', () => __awaiter(this, void 0, void 0, function* () {
    yield auth._getApplicationCredentialsFromFilePath('./test/fixtures/goodlink');
}));
it('getApplicationCredentialsFromFilePath should error on invalid symlink', () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield auth._getApplicationCredentialsFromFilePath('./test/fixtures/badlink');
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on valid link to invalid data', () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield auth._getApplicationCredentialsFromFilePath('./test/fixtures/emptylink');
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on null file path', () => __awaiter(this, void 0, void 0, function* () {
    try {
        // Test verifies invalid parameter tests, which requires cast to any.
        // tslint:disable-next-line no-any
        yield auth._getApplicationCredentialsFromFilePath(null);
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on empty file path', () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield auth._getApplicationCredentialsFromFilePath('');
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on non-string file path', () => __awaiter(this, void 0, void 0, function* () {
    try {
        // Test verifies invalid parameter tests, which requires cast to any.
        // tslint:disable-next-line no-any
        yield auth._getApplicationCredentialsFromFilePath(2);
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on invalid file path', () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield auth._getApplicationCredentialsFromFilePath('./nonexistantfile.json');
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should error on directory', () => __awaiter(this, void 0, void 0, function* () {
    // Make sure that the following path actually does point to a directory.
    const directory = './test/fixtures';
    assert.strictEqual(true, fs.lstatSync(directory).isDirectory());
    try {
        yield auth._getApplicationCredentialsFromFilePath(directory);
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('getApplicationCredentialsFromFilePath should handle errors thrown from createReadStream', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to throw from the createReadStream method.
    sandbox.stub(auth, '_createReadStream').throws('🤮');
    yield assertRejects(auth._getApplicationCredentialsFromFilePath('./test/fixtures/private.json'), /🤮/);
}));
it('getApplicationCredentialsFromFilePath should handle errors thrown from fromStream', () => __awaiter(this, void 0, void 0, function* () {
    sandbox.stub(auth, 'fromStream').throws('🤮');
    yield assertRejects(auth._getApplicationCredentialsFromFilePath('./test/fixtures/private.json'), /🤮/);
}));
it('getApplicationCredentialsFromFilePath should handle errors passed from fromStream', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return an error from the fromStream method.
    sandbox.stub(auth, 'fromStream').throws('🤮');
    yield assertRejects(auth._getApplicationCredentialsFromFilePath('./test/fixtures/private.json'), /🤮/);
}));
it('getApplicationCredentialsFromFilePath should correctly read the file and create a valid JWT', () => __awaiter(this, void 0, void 0, function* () {
    const result = yield auth._getApplicationCredentialsFromFilePath('./test/fixtures/private.json');
    assert(result);
    const jwt = result;
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
}));
it('getApplicationCredentialsFromFilePath should correctly read the file and create a valid JWT with eager refresh', () => __awaiter(this, void 0, void 0, function* () {
    const result = yield auth._getApplicationCredentialsFromFilePath('./test/fixtures/private.json', { eagerRefreshThresholdMillis: 7000 });
    assert(result);
    const jwt = result;
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
    assert.strictEqual(7000, jwt.eagerRefreshThresholdMillis);
}));
it('tryGetApplicationCredentialsFromEnvironmentVariable should return null when env const is not set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return a null path string.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS');
    const client = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    assert.strictEqual(client, null);
}));
it('tryGetApplicationCredentialsFromEnvironmentVariable should return null when env const is empty string', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return an empty path string.
    const stub = mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS');
    const client = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    assert.strictEqual(client, null);
}));
it('tryGetApplicationCredentialsFromEnvironmentVariable should handle invalid environment variable', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return a path to an invalid file.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './nonexistantfile.json');
    try {
        yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    }
    catch (e) {
        return;
    }
    assert.fail('failed to throw');
}));
it('tryGetApplicationCredentialsFromEnvironmentVariable should handle valid environment variable', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return path to a valid credentials file.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    const result = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    const jwt = result;
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
}));
it('tryGetApplicationCredentialsFromEnvironmentVariable should handle valid environment variable when there is eager refresh set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return path to a valid credentials file.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    const result = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable({ eagerRefreshThresholdMillis: 60 * 60 * 1000 });
    const jwt = result;
    assert.strictEqual(privateJSON.private_key, jwt.key);
    assert.strictEqual(privateJSON.client_email, jwt.email);
    assert.strictEqual(undefined, jwt.keyFile);
    assert.strictEqual(undefined, jwt.subject);
    assert.strictEqual(undefined, jwt.scope);
    assert.strictEqual(60 * 60 * 1000, jwt.eagerRefreshThresholdMillis);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should build the correct directory for Windows', () => __awaiter(this, void 0, void 0, function* () {
    let correctLocation = false;
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath = (filePath) => {
        if (filePath === 'foo:gcloud:application_default_credentials.json') {
            correctLocation = true;
        }
        return Promise.resolve({});
    };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert(result);
    assert(correctLocation);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should build the correct directory for non-Windows', () => {
    let correctLocation = false;
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath = (filePath) => {
        if (filePath ===
            'foo:.config:gcloud:application_default_credentials.json') {
            correctLocation = true;
        }
        return Promise.resolve({});
    };
    const client = auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert(client);
    assert(correctLocation);
});
it('_tryGetApplicationCredentialsFromWellKnownFile should fail on Windows when APPDATA is not defined', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath =
        (filePath) => {
            return Promise.resolve({});
        };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual(null, result);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should fail on non-Windows when HOME is not defined', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath =
        (filePath) => {
            return Promise.resolve({});
        };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual(null, result);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should fail on Windows when file does not exist', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => false;
    auth._getApplicationCredentialsFromFilePath =
        (filePath) => {
            return Promise.resolve({});
        };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual(null, result);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should fail on non-Windows when file does not exist', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => false;
    auth._getApplicationCredentialsFromFilePath =
        (filePath) => {
            return Promise.resolve({});
        };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual(null, result);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should succeeds on Windows', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath = (filePath) => {
        return Promise.resolve(new src_1.JWT('hello'));
    };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual('hello', result.email);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should succeeds on non-Windows', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath = (filePath) => {
        return Promise.resolve(new src_1.JWT('hello'));
    };
    const result = yield auth._tryGetApplicationCredentialsFromWellKnownFile();
    assert.strictEqual('hello', result.email);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should pass along a failure on Windows', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    sandbox.stub(auth, '_getApplicationCredentialsFromFilePath')
        .rejects('🤮');
    yield assertRejects(auth._tryGetApplicationCredentialsFromWellKnownFile(), /🤮/);
}));
it('_tryGetApplicationCredentialsFromWellKnownFile should pass along a failure on non-Windows', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => true;
    sandbox.stub(auth, '_getApplicationCredentialsFromFilePath')
        .rejects('🤮');
    yield assertRejects(auth._tryGetApplicationCredentialsFromWellKnownFile(), /🤮/);
}));
it('getProjectId should return a new projectId the first time and a cached projectId the second time', () => __awaiter(this, void 0, void 0, function* () {
    // Create a function which will set up a GoogleAuth instance to match
    // on an environment variable json file, but not on anything else.
    const setUpAuthForEnvironmentVariable = (creds) => {
        mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
        creds._fileExists = () => false;
    };
    setUpAuthForEnvironmentVariable(auth);
    // Ask for credentials, the first time.
    const projectIdPromise = auth.getProjectId();
    const projectId = yield projectIdPromise;
    assert.strictEqual(projectId, fixedProjectId);
    // Null out all the private functions that make this method work
    // tslint:disable-next-line no-any
    const anyd = auth;
    anyd.getProductionProjectId = null;
    anyd.getFileProjectId = null;
    anyd.getDefaultServiceProjectId = null;
    anyd.getGCEProjectId = null;
    // Ask for projectId again, from the same auth instance. If it isn't
    // cached, this will crash.
    const projectId2 = yield auth.getProjectId();
    // Make sure we get the original cached projectId back
    assert.strictEqual(fixedProjectId, projectId2);
    // Now create a second GoogleAuth instance, and ask for projectId.
    // We should get a new projectId instance this time.
    const auth2 = new src_1.GoogleAuth();
    setUpAuthForEnvironmentVariable(auth2);
    const getProjectIdPromise = auth2.getProjectId();
    assert.notEqual(getProjectIdPromise, projectIdPromise);
}));
it('getProjectId should use GCLOUD_PROJECT environment variable when it is set', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    const projectId = yield auth.getProjectId();
    assert.strictEqual(projectId, fixedProjectId);
}));
it('getProjectId should use GOOGLE_CLOUD_PROJECT environment variable when it is set', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GOOGLE_CLOUD_PROJECT', fixedProjectId);
    const projectId = yield auth.getProjectId();
    assert.strictEqual(projectId, fixedProjectId);
}));
it('getProjectId should use GOOGLE_APPLICATION_CREDENTIALS file when it is available', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', path.join(__dirname, '../../test/fixtures/private2.json'));
    const projectId = yield auth.getProjectId();
    assert.strictEqual(projectId, fixedProjectId);
}));
it('getProjectId should prefer configured projectId', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    mockEnvVar('GOOGLE_CLOUD_PROJECT', fixedProjectId);
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', path.join(__dirname, '../../test/fixtures/private2.json'));
    // nock.disableNetConnect() is also used globally in this file.
    const PROJECT_ID = 'configured-project-id-should-be-preferred';
    const auth = new src_1.GoogleAuth({ projectId: PROJECT_ID });
    const projectId = yield auth.getProjectId();
    assert.strictEqual(projectId, PROJECT_ID);
}));
it('getProjectId should work the same as getProjectId', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', path.join(__dirname, '../../test/fixtures/private2.json'));
    const projectId = yield auth.getProjectId();
    assert.strictEqual(projectId, fixedProjectId);
}));
it('getProjectId should use Cloud SDK when it is available and env vars are not set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is not set.
    // * Well-known file is set up to point to private2.json
    // * Running on GCE is set to true.
    blockGoogleApplicationCredentialEnvironmentVariable();
    const stdout = JSON.stringify({ configuration: { properties: { core: { project: fixedProjectId } } } });
    const stub = sandbox.stub(child_process, 'exec')
        .callsArgWith(1, null, stdout, null);
    const projectId = yield auth.getProjectId();
    assert(stub.calledOnce);
    assert.strictEqual(projectId, fixedProjectId);
}));
it('getProjectId should use GCE when well-known file and env const are not set', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    const stub = sandbox.stub(child_process, 'exec').callsArgWith(1, null, '', null);
    const scope = createGetProjectIdNock(fixedProjectId);
    const projectId = yield auth.getProjectId();
    assert(stub.calledOnce);
    assert.strictEqual(projectId, fixedProjectId);
    scope.done();
}));
it('getApplicationDefault should return a new credential the first time and a cached credential the second time', () => __awaiter(this, void 0, void 0, function* () {
    const scope = nockNotGCE();
    // Create a function which will set up a GoogleAuth instance to match
    // on an environment variable json file, but not on anything else.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    auth._fileExists = () => false;
    // Ask for credentials, the first time.
    const result = yield auth.getApplicationDefault();
    scope.isDone();
    assert.notEqual(null, result);
    // Capture the returned credential.
    const cachedCredential = result.credential;
    // Make sure our special test bit is not set yet, indicating that
    // this is a new credentials instance.
    // Test verifies invalid parameter tests, which requires cast to any.
    // tslint:disable-next-line no-any
    assert.strictEqual(undefined, cachedCredential.specialTestBit);
    // Now set the special test bit.
    // Test verifies invalid parameter tests, which requires cast to any.
    // tslint:disable-next-line no-any
    cachedCredential.specialTestBit = 'monkey';
    // Ask for credentials again, from the same auth instance. We expect
    // a cached instance this time.
    const result2 = (yield auth.getApplicationDefault()).credential;
    assert.notEqual(null, result2);
    // Make sure the special test bit is set on the credentials we got
    // back, indicating that we got cached credentials. Also make sure
    // the object instance is the same.
    // Test verifies invalid parameter tests, which requires cast to
    // any.
    // tslint:disable-next-line no-any
    assert.strictEqual('monkey', result2.specialTestBit);
    assert.strictEqual(cachedCredential, result2);
    // Now create a second GoogleAuth instance, and ask for
    // credentials. We should get a new credentials instance this time.
    const auth2 = new src_1.GoogleAuth();
    auth2._fileExists = () => false;
    const result3 = (yield auth2.getApplicationDefault()).credential;
    assert.notEqual(null, result3);
    // Make sure we get a new (non-cached) credential instance back.
    // Test verifies invalid parameter tests, which requires cast to
    // any.
    // tslint:disable-next-line no-any
    assert.strictEqual(undefined, result3.specialTestBit);
    assert.notEqual(cachedCredential, result3);
}));
it('getApplicationDefault should cache the credential when using GCE', () => __awaiter(this, void 0, void 0, function* () {
    blockGoogleApplicationCredentialEnvironmentVariable();
    auth._fileExists = () => false;
    const scope = nockIsGCE();
    // Ask for credentials, the first time.
    const result = yield auth.getApplicationDefault();
    scope.done();
    assert.notEqual(null, result);
    // Capture the returned credential.
    const cachedCredential = result.credential;
    // Ask for credentials again, from the same auth instance. We expect
    // a cached instance this time.
    const result2 = (yield auth.getApplicationDefault()).credential;
    assert.notEqual(null, result2);
    // Make sure it's the same object
    assert.strictEqual(cachedCredential, result2);
}));
it('getApplicationDefault should use environment variable when it is set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is set up to point to private.json
    // * Well-known file is set up to point to private2.json
    // * Running on GCE is set to true.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    nockIsGCE();
    insertWellKnownFilePathIntoAuth(auth, 'foo:gcloud:application_default_credentials.json', './test/fixtures/private2.json');
    const res = yield auth.getApplicationDefault();
    const client = res.credential;
    assert.strictEqual(privateJSON.private_key, client.key);
    assert.strictEqual(privateJSON.client_email, client.email);
    assert.strictEqual(undefined, client.keyFile);
    assert.strictEqual(undefined, client.subject);
    assert.strictEqual(undefined, client.scope);
}));
it('should use well-known file when it is available and env const is not set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is not set.
    // * Well-known file is set up to point to private2.json
    // * Running on GCE is set to true.
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    nockIsGCE();
    insertWellKnownFilePathIntoAuth(auth, 'foo:gcloud:application_default_credentials.json', './test/fixtures/private2.json');
    const res = yield auth.getApplicationDefault();
    const client = res.credential;
    assert.strictEqual(private2JSON.private_key, client.key);
    assert.strictEqual(private2JSON.client_email, client.email);
    assert.strictEqual(undefined, client.keyFile);
    assert.strictEqual(undefined, client.subject);
    assert.strictEqual(undefined, client.scope);
}));
it('getApplicationDefault should use GCE when well-known file and env const are not set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is not set.
    // * Well-known file is not set.
    // * Running on GCE is set to true.
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => false;
    const scope = nockIsGCE();
    const res = yield auth.getApplicationDefault();
    scope.done();
    // This indicates that we got a ComputeClient instance back, rather than a
    // JWTClient.
    assert.strictEqual('compute-placeholder', res.credential.credentials.refresh_token);
}));
it('getApplicationDefault should report GCE error when checking for GCE fails', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is not set.
    // * Well-known file is not set.
    // * Running on GCE is set to true.
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => false;
    sandbox.stub(auth, '_checkIsGCE').rejects('🤮');
    yield assertRejects(auth.getApplicationDefault(), /Unexpected error determining execution environment/);
}));
it('getApplicationDefault should also get project ID', () => __awaiter(this, void 0, void 0, function* () {
    // Set up the creds.
    // * Environment variable is set up to point to private.json
    // * Well-known file is set up to point to private2.json
    // * Running on GCE is set to true.
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    auth._checkIsGCE = () => Promise.resolve(true);
    insertWellKnownFilePathIntoAuth(auth, 'foo:gcloud:application_default_credentials.json', './test/fixtures/private2.json');
    const res = yield auth.getApplicationDefault();
    const client = res.credential;
    assert.strictEqual(privateJSON.private_key, client.key);
    assert.strictEqual(privateJSON.client_email, client.email);
    assert.strictEqual(res.projectId, fixedProjectId);
    assert.strictEqual(undefined, client.keyFile);
    assert.strictEqual(undefined, client.subject);
    assert.strictEqual(undefined, client.scope);
}));
it('_checkIsGCE should set the _isGCE flag when running on GCE', () => __awaiter(this, void 0, void 0, function* () {
    assert.notEqual(true, auth.isGCE);
    const scope = nockIsGCE();
    yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    scope.done();
}));
it('_checkIsGCE should not set the _isGCE flag when not running on GCE', () => __awaiter(this, void 0, void 0, function* () {
    const scope = nockNotGCE();
    assert.notEqual(true, auth.isGCE);
    yield auth._checkIsGCE();
    assert.strictEqual(false, auth.isGCE);
    scope.done();
}));
it('_checkIsGCE should retry the check for isGCE on transient http errors', () => __awaiter(this, void 0, void 0, function* () {
    assert.notEqual(true, auth.isGCE);
    // the first request will fail, the second one will succeed
    const scopes = [nock500GCE(), nockIsGCE()];
    yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    scopes.forEach(s => s.done());
}));
it('_checkIsGCE should throw on unexpected errors', () => __awaiter(this, void 0, void 0, function* () {
    assert.notEqual(true, auth.isGCE);
    const scope = nock404GCE();
    yield assertRejects(auth._checkIsGCE());
    assert.strictEqual(undefined, auth.isGCE);
    scope.done();
}));
it('_checkIsGCE should not retry the check for isGCE if it fails with an ENOTFOUND', () => __awaiter(this, void 0, void 0, function* () {
    assert.notEqual(true, auth.isGCE);
    const scope = nockNotGCE();
    const isGCE = yield auth._checkIsGCE();
    assert.strictEqual(false, auth.isGCE);
    scope.done();
}));
it('_checkIsGCE does not execute the second time when running on GCE', () => __awaiter(this, void 0, void 0, function* () {
    // This test relies on the nock mock only getting called once.
    assert.notEqual(true, auth.isGCE);
    const scope = nockIsGCE();
    yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    const isGCE2 = yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    scope.done();
}));
it('_checkIsGCE does not execute the second time when not running on GCE', () => __awaiter(this, void 0, void 0, function* () {
    assert.notEqual(true, auth.isGCE);
    const scope = nockNotGCE();
    yield auth._checkIsGCE();
    assert.strictEqual(false, auth.isGCE);
    yield auth._checkIsGCE();
    assert.strictEqual(false, auth.isGCE);
    scope.done();
}));
it('getCredentials should get metadata from the server when running on GCE', () => __awaiter(this, void 0, void 0, function* () {
    nockIsGCE();
    const isGCE = yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    const response = {
        default: {
            email: 'test-creds@test-creds.iam.gserviceaccount.com',
            private_key: null
        }
    };
    nock.cleanAll();
    const scope = nock(host).get(svcAccountPath).reply(200, response, gcp_metadata_1.HEADERS);
    const body = yield auth.getCredentials();
    assert(body);
    assert.strictEqual(body.client_email, 'test-creds@test-creds.iam.gserviceaccount.com');
    assert.strictEqual(body.private_key, undefined);
    scope.done();
}));
it('getCredentials should error if metadata server is not reachable', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [nockIsGCE(), nock(gcp_metadata_1.HOST_ADDRESS).get(svcAccountPath).reply(404)];
    yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    yield assertRejects(auth.getCredentials());
    scopes.forEach(s => s.done());
}));
it('getCredentials should error if body is empty', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [nockIsGCE(), nock(gcp_metadata_1.HOST_ADDRESS).get(svcAccountPath).reply(200, {})];
    yield auth._checkIsGCE();
    assert.strictEqual(true, auth.isGCE);
    yield assertRejects(auth.getCredentials());
    scopes.forEach(s => s.done());
}));
it('getCredentials should handle valid environment variable', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return path to a valid credentials file.
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './test/fixtures/private.json');
    const result = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    assert(result);
    const jwt = result;
    const body = yield auth.getCredentials();
    assert.notEqual(null, body);
    assert.strictEqual(jwt.email, body.client_email);
    assert.strictEqual(jwt.key, body.private_key);
}));
it('getCredentials should handle valid file path', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return path to a valid credentials file.
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('APPDATA', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'win32';
    auth._fileExists = () => true;
    auth._checkIsGCE = () => Promise.resolve(true);
    insertWellKnownFilePathIntoAuth(auth, 'foo:gcloud:application_default_credentials.json', './test/fixtures/private2.json');
    const result = yield auth.getApplicationDefault();
    assert(result);
    const jwt = result.credential;
    const body = yield auth.getCredentials();
    assert.notEqual(null, body);
    assert.strictEqual(jwt.email, body.client_email);
    assert.strictEqual(jwt.key, body.private_key);
}));
it('getCredentials should return error when env const is not set', () => __awaiter(this, void 0, void 0, function* () {
    // Set up a mock to return a null path string
    mockEnvVar('GOOGLE_APPLICATION_CREDENTIALS');
    const client = yield auth._tryGetApplicationCredentialsFromEnvironmentVariable();
    assert.strictEqual(null, client);
    yield assertRejects(auth.getCredentials());
}));
it('should use jsonContent if available', () => __awaiter(this, void 0, void 0, function* () {
    const json = createJwtJSON();
    auth.fromJSON(json);
    // We know this returned a cached result if a nock scope isn't required
    const body = yield auth.getCredentials();
    assert.notEqual(body, null);
    assert.strictEqual(body.client_email, 'hello@youarecool.com');
}));
it('should accept keyFilename to get a client', () => __awaiter(this, void 0, void 0, function* () {
    const auth = new src_1.GoogleAuth({ keyFilename: './test/fixtures/private.json' });
    const client = yield auth.getClient();
    assert.strictEqual(client.email, 'hello@youarecool.com');
}));
it('should error when invalid keyFilename passed to getClient', () => __awaiter(this, void 0, void 0, function* () {
    const auth = new src_1.GoogleAuth();
    yield assertRejects(auth.getClient({ keyFilename: './funky/fresh.json' }), /ENOENT: no such file or directory/);
}));
it('should accept credentials to get a client', () => __awaiter(this, void 0, void 0, function* () {
    const credentials = require('../../test/fixtures/private.json');
    const auth = new src_1.GoogleAuth({ credentials });
    const client = yield auth.getClient();
    assert.strictEqual(client.email, 'hello@youarecool.com');
}));
it('should prefer credentials over keyFilename', () => __awaiter(this, void 0, void 0, function* () {
    const credentials = Object.assign(require('../../test/fixtures/private.json'), { client_email: 'hello@butiamcooler.com' });
    const auth = new src_1.GoogleAuth({ credentials, keyFilename: './test/fixtures/private.json' });
    const client = yield auth.getClient();
    assert.strictEqual(client.email, credentials.client_email);
}));
it('should allow passing scopes to get a client', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = ['http://examples.com/is/a/scope'];
    const keyFilename = './test/fixtures/private.json';
    const client = yield auth.getClient({ scopes, keyFilename });
    assert.strictEqual(client.scopes, scopes);
}));
it('should allow passing a scope to get a client', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = 'http://examples.com/is/a/scope';
    const keyFilename = './test/fixtures/private.json';
    const client = yield auth.getClient({ scopes, keyFilename });
    assert.strictEqual(client.scopes, scopes);
}));
it('should get an access token', () => __awaiter(this, void 0, void 0, function* () {
    const { auth, scopes } = mockGCE();
    const token = yield auth.getAccessToken();
    scopes.forEach(s => s.done());
    assert.strictEqual(token, 'abc123');
}));
it('should get request headers', () => __awaiter(this, void 0, void 0, function* () {
    const { auth, scopes } = mockGCE();
    const headers = yield auth.getRequestHeaders();
    scopes.forEach(s => s.done());
    assert.deepStrictEqual(headers, { Authorization: 'Bearer abc123' });
}));
it('should authorize the request', () => __awaiter(this, void 0, void 0, function* () {
    const { auth, scopes } = mockGCE();
    const opts = yield auth.authorizeRequest({ url: 'http://example.com' });
    scopes.forEach(s => s.done());
    assert.deepStrictEqual(opts.headers, { Authorization: 'Bearer abc123' });
}));
it('should get the current environment if GCE', () => __awaiter(this, void 0, void 0, function* () {
    envDetect.clear();
    const { auth, scopes } = mockGCE();
    const env = yield auth.getEnv();
    assert.strictEqual(env, envDetect.GCPEnv.COMPUTE_ENGINE);
}));
it('should get the current environment if GKE', () => __awaiter(this, void 0, void 0, function* () {
    envDetect.clear();
    const { auth, scopes } = mockGCE();
    const scope = nock(host)
        .get(`${instancePath}/attributes/cluster-name`)
        .reply(200, {}, gcp_metadata_1.HEADERS);
    const env = yield auth.getEnv();
    assert.strictEqual(env, envDetect.GCPEnv.KUBERNETES_ENGINE);
    scope.done();
}));
it('should get the current environment if GCF', () => __awaiter(this, void 0, void 0, function* () {
    envDetect.clear();
    mockEnvVar('FUNCTION_NAME', 'DOGGY');
    const env = yield auth.getEnv();
    assert.strictEqual(env, envDetect.GCPEnv.CLOUD_FUNCTIONS);
}));
it('should get the current environment if GAE', () => __awaiter(this, void 0, void 0, function* () {
    envDetect.clear();
    mockEnvVar('GAE_SERVICE', 'KITTY');
    const env = yield auth.getEnv();
    assert.strictEqual(env, envDetect.GCPEnv.APP_ENGINE);
}));
it('should make the request', () => __awaiter(this, void 0, void 0, function* () {
    const url = 'http://example.com';
    const { auth, scopes } = mockGCE();
    const data = { breakfast: 'coffee' };
    const scope = nock(url).get('/').reply(200, data);
    scopes.push(scope);
    const res = yield auth.request({ url });
    scopes.forEach(s => s.done());
    assert.deepStrictEqual(res.data, data);
}));
it('sign should use the private key for JWT clients', () => __awaiter(this, void 0, void 0, function* () {
    const data = 'abc123';
    const auth = new src_1.GoogleAuth({
        credentials: { client_email: 'google@auth.library', private_key: privateKey }
    });
    const value = yield auth.sign(data);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    const computed = sign.sign(privateKey, 'base64');
    assert.strictEqual(value, computed);
}));
it('sign should hit the IAM endpoint if no private_key is available', () => __awaiter(this, void 0, void 0, function* () {
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    const { auth, scopes } = mockGCE();
    const email = 'google@auth.library';
    const iamUri = `https://iam.googleapis.com`;
    const iamPath = `/v1/projects/${fixedProjectId}/serviceAccounts/${email}:signBlob`;
    const signature = 'erutangis';
    const data = 'abc123';
    scopes.push(nock(iamUri).post(iamPath).reply(200, { signature }), nock(host)
        .get(svcAccountPath)
        .reply(200, { default: { email, private_key: privateKey } }, gcp_metadata_1.HEADERS));
    const value = yield auth.sign(data);
    scopes.forEach(x => x.done());
    assert.strictEqual(value, signature);
}));
it('should warn the user if using default Cloud SDK credentials', done => {
    blockGoogleApplicationCredentialEnvironmentVariable();
    mockEnvVar('HOME', 'foo');
    auth._pathJoin = pathJoin;
    auth._osPlatform = () => 'linux';
    auth._fileExists = () => true;
    auth._getApplicationCredentialsFromFilePath = () => {
        return Promise.resolve(new src_1.JWT(googleauth_1.CLOUD_SDK_CLIENT_ID));
    };
    sandbox.stub(process, 'emitWarning')
        .callsFake((message, warningOrType) => {
        assert.strictEqual(message, messages.PROBLEMATIC_CREDENTIALS_WARNING.message);
        const warningType = typeof warningOrType === 'string' ?
            warningOrType :
            // @types/node doesn't recognize the emitWarning syntax which
            // tslint:disable-next-line no-any
            warningOrType.type;
        assert.strictEqual(warningType, messages.WarningTypes.WARNING);
        done();
    });
    auth._tryGetApplicationCredentialsFromWellKnownFile();
});
it('should warn the user if using the getDefaultProjectId method', done => {
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    sandbox.stub(process, 'emitWarning')
        .callsFake((message, warningOrType) => {
        assert.strictEqual(message, messages.DEFAULT_PROJECT_ID_DEPRECATED.message);
        const warningType = typeof warningOrType === 'string' ?
            warningOrType :
            // @types/node doesn't recognize the emitWarning syntax which
            // tslint:disable-next-line no-any
            warningOrType.type;
        assert.strictEqual(warningType, messages.WarningTypes.DEPRECATION);
        done();
    });
    auth.getDefaultProjectId();
});
it('should only emit warnings once', () => __awaiter(this, void 0, void 0, function* () {
    // The warning was used above, so invoking it here should have no effect.
    mockEnvVar('GCLOUD_PROJECT', fixedProjectId);
    let count = 0;
    sandbox.stub(process, 'emitWarning').callsFake(() => count++);
    yield auth.getDefaultProjectId();
    assert.strictEqual(count, 0);
}));
//# sourceMappingURL=test.googleauth.js.map