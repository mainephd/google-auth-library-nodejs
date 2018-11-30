"use strict";
/**
 * Copyright 2013 Google Inc. All Rights Reserved.
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
const gcp_metadata_1 = require("gcp-metadata");
const nock = require("nock");
const sinon = require("sinon");
const src_1 = require("../src");
const assertRejects = require('assert-rejects');
nock.disableNetConnect();
const url = 'http://example.com';
const tokenPath = `${gcp_metadata_1.BASE_PATH}/instance/service-accounts/default/token`;
function mockToken(statusCode = 200) {
    return nock(gcp_metadata_1.HOST_ADDRESS)
        .get(tokenPath, undefined, { reqheaders: gcp_metadata_1.HEADERS })
        .reply(statusCode, { access_token: 'abc123', expires_in: 10000 }, gcp_metadata_1.HEADERS);
}
function mockExample() {
    return nock(url).get('/').reply(200);
}
// set up compute client.
let sandbox;
let compute;
beforeEach(() => {
    compute = new src_1.Compute();
    sandbox = sinon.createSandbox();
});
afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
});
it('should create a dummy refresh token string', () => {
    // It is important that the compute client is created with a refresh token
    // value filled in, or else the rest of the logic will not work.
    const compute = new src_1.Compute();
    assert.strictEqual('compute-placeholder', compute.credentials.refresh_token);
});
it('should get an access token for the first request', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [mockToken(), mockExample()];
    yield compute.request({ url });
    scopes.forEach(s => s.done());
    assert.strictEqual(compute.credentials.access_token, 'abc123');
}));
it('should refresh if access token has expired', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [mockToken(), mockExample()];
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() - 10000;
    yield compute.request({ url });
    assert.strictEqual(compute.credentials.access_token, 'abc123');
    scopes.forEach(s => s.done());
}));
it('should emit an event for a new access token', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [mockToken(), mockExample()];
    let raisedEvent = false;
    compute.on('tokens', tokens => {
        assert.strictEqual(tokens.access_token, 'abc123');
        raisedEvent = true;
    });
    yield compute.request({ url });
    assert.strictEqual(compute.credentials.access_token, 'abc123');
    scopes.forEach(s => s.done());
    assert(raisedEvent);
}));
it('should refresh if access token will expired soon and time to refresh before expiration is set', () => __awaiter(this, void 0, void 0, function* () {
    const scopes = [mockToken(), mockExample()];
    compute = new src_1.Compute({ eagerRefreshThresholdMillis: 10000 });
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() + 5000;
    yield compute.request({ url });
    assert.strictEqual(compute.credentials.access_token, 'abc123');
    scopes.forEach(s => s.done());
}));
it('should not refresh if access token will not expire soon and time to refresh before expiration is set', () => __awaiter(this, void 0, void 0, function* () {
    const scope = mockExample();
    compute = new src_1.Compute({ eagerRefreshThresholdMillis: 1000 });
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() + 12000;
    yield compute.request({ url });
    assert.strictEqual(compute.credentials.access_token, 'initial-access-token');
    scope.done();
}));
it('should not refresh if access token has not expired', () => __awaiter(this, void 0, void 0, function* () {
    const scope = mockExample();
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() + 10 * 60 * 1000;
    yield compute.request({ url });
    assert.strictEqual(compute.credentials.access_token, 'initial-access-token');
    scope.done();
}));
it('should emit warning for createScopedRequired', () => {
    let called = false;
    sandbox.stub(process, 'emitWarning').callsFake(() => called = true);
    compute.createScopedRequired();
    assert.strictEqual(called, true);
});
it('should return false for createScopedRequired', () => {
    assert.strictEqual(false, compute.createScopedRequired());
});
it('should return a helpful message on request response.statusCode 403', () => __awaiter(this, void 0, void 0, function* () {
    // Mock the credentials object. Make sure there's no expiry_date set.
    compute.credentials = { refresh_token: 'hello', access_token: 'goodbye' };
    const scopes = [
        nock(url).get('/').reply(403), nock(gcp_metadata_1.HOST_ADDRESS).get(tokenPath).reply(403)
    ];
    const expected = new RegExp('A Forbidden error was returned while attempting to retrieve an access ' +
        'token for the Compute Engine built-in service account. This may be because the ' +
        'Compute Engine instance does not have the correct permission scopes specified. ' +
        'Could not refresh access token.');
    yield assertRejects(compute.request({ url }), expected);
    scopes.forEach(s => s.done());
}));
it('should return a helpful message on request response.statusCode 404', () => __awaiter(this, void 0, void 0, function* () {
    // Mock the credentials object.
    compute.credentials = {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: (new Date(9999, 1, 1)).getTime()
    };
    // Mock the request method to return a 404.
    const scope = nock(url).get('/').reply(404);
    const expected = new RegExp('A Not Found error was returned while attempting to retrieve an access' +
        'token for the Compute Engine built-in service account. This may be because the ' +
        'Compute Engine instance does not have any permission scopes specified.');
    yield assertRejects(compute.request({ url }), expected);
    scope.done();
}));
it('should return a helpful message on token refresh response.statusCode 403', () => __awaiter(this, void 0, void 0, function* () {
    const scope = mockToken(403);
    // Mock the credentials object with a null access token, to force a
    // refresh.
    compute.credentials = {
        refresh_token: 'hello',
        access_token: undefined,
        expiry_date: 1
    };
    const expected = new RegExp('A Forbidden error was returned while attempting to retrieve an access ' +
        'token for the Compute Engine built-in service account. This may be because the ' +
        'Compute Engine instance does not have the correct permission scopes specified. ' +
        'Could not refresh access token.');
    yield assertRejects(compute.request({}), expected);
    scope.done();
}));
it('should return a helpful message on token refresh response.statusCode 404', () => __awaiter(this, void 0, void 0, function* () {
    const scope = mockToken(404);
    // Mock the credentials object with a null access token, to force a
    // refresh.
    compute.credentials = {
        refresh_token: 'hello',
        access_token: undefined,
        expiry_date: 1
    };
    const expected = new RegExp('A Not Found error was returned while attempting to retrieve an access' +
        'token for the Compute Engine built-in service account. This may be because the ' +
        'Compute Engine instance does not have any permission scopes specified. Could not ' +
        'refresh access token.');
    yield assertRejects(compute.request({}), expected);
    scope.done();
}));
it('should accept a custom service account', () => __awaiter(this, void 0, void 0, function* () {
    const serviceAccountEmail = 'service-account@example.com';
    const compute = new src_1.Compute({ serviceAccountEmail });
    const scopes = [
        mockExample(),
        nock(gcp_metadata_1.HOST_ADDRESS)
            .get(`${gcp_metadata_1.BASE_PATH}/instance/service-accounts/${serviceAccountEmail}/token`)
            .reply(200, { access_token: 'abc123', expires_in: 10000 }, gcp_metadata_1.HEADERS)
    ];
    yield compute.request({ url });
    scopes.forEach(s => s.done());
    assert.strictEqual(compute.credentials.access_token, 'abc123');
}));
//# sourceMappingURL=test.compute.js.map