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
const sinon = require("sinon");
const src_1 = require("../src");
const messages = require("../src/messages");
const testSelector = 'a-test-selector';
const testToken = 'a-test-token';
let sandbox;
let client;
beforeEach(() => {
    sandbox = sinon.createSandbox();
    client = new src_1.IAMAuth(testSelector, testToken);
});
afterEach(() => {
    sandbox.restore();
});
it('passes the token and selector to the callback ', () => __awaiter(this, void 0, void 0, function* () {
    const creds = client.getRequestHeaders();
    assert.notStrictEqual(creds, null, 'metadata should be present');
    assert.strictEqual(creds['x-goog-iam-authority-selector'], testSelector);
    assert.strictEqual(creds['x-goog-iam-authorization-token'], testToken);
}));
it('should warn about deprecation of getRequestMetadata', done => {
    const stub = sandbox.stub(messages, 'warn');
    client.getRequestMetadata(null, () => {
        assert.strictEqual(stub.calledOnce, true);
        done();
    });
});
it('should emit warning for createScopedRequired', () => {
    const stub = sandbox.stub(process, 'emitWarning');
    client.createScopedRequired();
    assert(stub.called);
});
//# sourceMappingURL=test.iam.js.map