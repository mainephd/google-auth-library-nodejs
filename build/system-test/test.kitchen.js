"use strict";
/**
 * Copyright 2017 Google Inc. All Rights Reserved.
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
const cp = require("child_process");
const mv = require("mv");
const ncp_1 = require("ncp");
const tmp = require("tmp");
const util_1 = require("util");
const mvp = util_1.promisify(mv);
const ncpp = util_1.promisify(ncp_1.ncp);
const keep = !!process.env.GALN_KEEP_TEMPDIRS;
const stagingDir = tmp.dirSync({ keep, unsafeCleanup: true });
const stagingPath = stagingDir.name;
const pkg = require('../../package.json');
const spawnp = (command, args, options = {}) => {
    return new Promise((resolve, reject) => {
        cp.spawn(command, args, Object.assign(options, { stdio: 'inherit' }))
            .on('close', code => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Spawn failed with an exit code of ${code}`));
            }
        })
            .on('error', err => {
            reject(err);
        });
    });
};
/**
 * Create a staging directory with temp fixtures used
 * to test on a fresh application.
 */
it('should be able to use the d.ts', () => __awaiter(this, void 0, void 0, function* () {
    console.log(`${__filename} staging area: ${stagingPath}`);
    yield spawnp('npm', ['pack']);
    const tarball = `${pkg.name}-${pkg.version}.tgz`;
    // stagingPath can be on another filesystem so fs.rename() will fail
    // with EXDEV, hence we use `mv` module here.
    yield mvp(tarball, `${stagingPath}/google-auth-library.tgz`);
    yield ncpp('system-test/fixtures/kitchen', `${stagingPath}/`);
    yield spawnp('npm', ['install'], { cwd: `${stagingPath}/` });
})).timeout(40000);
/**
 * CLEAN UP - remove the staging directory when done.
 */
after('cleanup staging', () => __awaiter(this, void 0, void 0, function* () {
    if (!keep) {
        stagingDir.removeCallback();
    }
}));
//# sourceMappingURL=test.kitchen.js.map