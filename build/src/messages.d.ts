/**
 * Copyright 2018 Google LLC. All Rights Reserved.
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
export declare enum WarningTypes {
    WARNING = "Warning",
    DEPRECATION = "DeprecationWarning"
}
export declare function warn(warning: Warning): void;
export interface Warning {
    code: string;
    type: WarningTypes;
    message: string;
    warned?: boolean;
}
export declare const PROBLEMATIC_CREDENTIALS_WARNING: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const DEFAULT_PROJECT_ID_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const COMPUTE_CREATE_SCOPED_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const JWT_CREATE_SCOPED_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const IAM_CREATE_SCOPED_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const JWT_ACCESS_CREATE_SCOPED_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const REFRESH_ACCESS_TOKEN_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const OAUTH_GET_REQUEST_METADATA_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const IAM_GET_REQUEST_METADATA_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
export declare const JWT_ACCESS_GET_REQUEST_METADATA_DEPRECATED: {
    code: string;
    type: WarningTypes;
    message: string;
};
