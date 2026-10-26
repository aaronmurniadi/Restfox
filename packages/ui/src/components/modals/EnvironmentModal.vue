<template>
    <form @submit.prevent="done" v-if="showModalComp">
        <modal
            :title="`Environment — ${collectionItem ? collectionItem.name : workspace.name}`"
            v-model="showModalComp"
            height="70vh"
            width="55rem"
        >
            <template #after-title>
                <button type="button" class="button" @click="importEnvironment">
                    <i class="fa fa-file-import"></i> Import
                </button>
                <button
                    type="button"
                    class="button ml-1rem"
                    @click="exportEnvironment"
                >
                    <i class="fa fa-file-export"></i> Export
                </button>
            </template>

            <div class="env-body">
                <div class="env-sidebar-col">
                    <button
                        class="button"
                        type="button"
                        style="margin-bottom: 0.5rem; margin-right: 0.5rem"
                        @click="addEnvironment()"
                    >
                        Add Environment
                    </button>
                    <div style="overflow-y: auto" class="environment-sidebar">
                        <div
                            v-if="workspace"
                            class="environment-sidebar-item"
                            :class="{
                                'environment-sidebar-item-active':
                                    editingGlobals,
                            }"
                            @click="editGlobals"
                        >
                            <div style="display: flex; align-items: center">
                                <i
                                    class="fa fa-globe"
                                    style="margin-right: 0.5rem"
                                ></i
                                >Globals
                            </div>
                        </div>
                        <div
                            v-if="workspace"
                            class="environment-sidebar-divider"
                        ></div>
                        <div
                            v-for="(environment, index) in environments"
                            :key="environment.name"
                            class="environment-sidebar-item"
                            :class="{
                                'environment-sidebar-item-active':
                                    !editingGlobals &&
                                    environment.name === currentEnvironment,
                            }"
                            @click="changeEnvironment(environment)"
                            :ref="'environment-' + environment.name"
                            draggable="true"
                            @dragstart="onDragStart(index, $event)"
                            @dragover.prevent
                            @dragenter.prevent
                            @drop="onDrop(index)"
                            @dragend="onDragEnd"
                        >
                            <div style="display: flex; align-items: center">
                                <span
                                    v-if="readEnvironmentEmoji(environment)"
                                    class="environment-emoji"
                                    >{{
                                        readEnvironmentEmoji(environment)
                                    }}</span
                                >
                                <i
                                    v-else
                                    class="fa fa-circle"
                                    :style="{
                                        color: environment.color,
                                        marginRight: '0.5rem',
                                    }"
                                ></i
                                >{{ environment.name }}
                            </div>

                            <div
                                class="environment-sidebar-item-menu"
                                :class="{
                                    'environment-sidebar-item-menu-disable-hide':
                                        environment.name ===
                                            clickedContextMenuEnvironment.name &&
                                        showEnvironmentContextMenuPopup ===
                                            true,
                                }"
                                @click.stop="
                                    showEnvironmentContextMenu(
                                        $event,
                                        environment,
                                    )
                                "
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    style="
                                        pointer-events: none;
                                        display: block;
                                        width: 100%;
                                        height: 100%;
                                    "
                                >
                                    <g>
                                        <path
                                            d="M12,16.5c0.83,0,1.5,0.67,1.5,1.5s-0.67,1.5-1.5,1.5s-1.5-0.67-1.5-1.5S11.17,16.5,12,16.5z M10.5,12 c0,0.83,0.67,1.5,1.5,1.5s1.5-0.67,1.5-1.5s-0.67-1.5-1.5-1.5S10.5,11.17,10.5,12z M10.5,6c0,0.83,0.67,1.5,1.5,1.5 s1.5-0.67,1.5-1.5S12.83,4.5,12,4.5S10.5,5.17,10.5,6z"
                                            style="fill: var(--text-color)"
                                        ></path>
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="env-editor-col">
                    <div class="env-editor-tabs">
                        <button
                            type="button"
                            class="button"
                            :class="{
                                'env-editor-tab-active':
                                    editorMode === 'variables',
                            }"
                            @click="setEditorMode('variables')"
                        >
                            Variables
                        </button>
                        <button
                            type="button"
                            class="button"
                            :class="{
                                'env-editor-tab-active':
                                    editorMode === 'secrets',
                            }"
                            @click="setEditorMode('secrets')"
                        >
                            Secrets
                        </button>
                    </div>
                    <div
                        v-if="editorMode === 'secrets'"
                        class="env-secrets-lock"
                    >
                        <div v-if="secretsLocked" class="env-secrets-locked">
                            <div>
                                Secret values are encrypted. Enter the password
                                to use them.
                            </div>
                            <input
                                type="password"
                                class="env-kv-secret"
                                v-model="secretsPassword"
                                autocomplete="current-password"
                                spellcheck="false"
                                placeholder="Password"
                                @keydown.enter.prevent="
                                    unlockSecretsFromPassword
                                "
                            />
                            <button
                                type="button"
                                class="button"
                                :disabled="secretsBusy"
                                @click="unlockSecretsFromPassword"
                            >
                                Unlock
                            </button>
                        </div>
                        <div v-else class="env-secrets-actions">
                            <button
                                v-if="!secretsEncrypted"
                                type="button"
                                class="button"
                                :disabled="secretsBusy"
                                @click="enableSecretEncryption"
                            >
                                Encrypt with password
                            </button>
                            <template v-else>
                                <span class="env-secrets-state">Encrypted</span>
                                <button
                                    type="button"
                                    class="button"
                                    :disabled="secretsBusy"
                                    @click="lockSecrets"
                                >
                                    Lock
                                </button>
                                <button
                                    type="button"
                                    class="button"
                                    :disabled="secretsBusy"
                                    @click="changeSecretPassword"
                                >
                                    Change password
                                </button>
                                <button
                                    type="button"
                                    class="button"
                                    :disabled="secretsBusy"
                                    @click="removeSecretEncryption"
                                >
                                    Remove encryption
                                </button>
                            </template>
                        </div>
                    </div>
                    <div
                        v-if="!(editorMode === 'secrets' && secretsLocked)"
                        class="env-kv-editor"
                        @keydown.enter.prevent
                    >
                        <table class="env-kv-table">
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th></th>
                            </tr>
                            <tr v-for="(row, index) in rows" :key="row.id">
                                <td>
                                    <CodeMirrorSingleLine
                                        v-model="row.key"
                                        placeholder="key"
                                        :input-text-compatible="true"
                                        @update:modelValue="
                                            onEnvironmentRowInput
                                        "
                                    />
                                </td>
                                <td>
                                    <div class="env-kv-value">
                                        <input
                                            v-if="
                                                editorMode === 'secrets' &&
                                                !row.revealed
                                            "
                                            type="password"
                                            class="env-kv-secret"
                                            v-model="row.value"
                                            placeholder="value"
                                            spellcheck="false"
                                            autocomplete="new-password"
                                            @input="onEnvironmentRowInput"
                                        />
                                        <CodeMirrorSingleLine
                                            v-else
                                            v-model="row.value"
                                            placeholder="value"
                                            :env-variables="envVariables"
                                            :autocompletions="
                                                tagAutocompletions
                                            "
                                            :input-text-compatible="true"
                                            @tagClick="onTagClick"
                                            @update:modelValue="
                                                onEnvironmentRowInput
                                            "
                                        />
                                        <button
                                            v-if="editorMode === 'secrets'"
                                            type="button"
                                            class="env-kv-reveal"
                                            :title="
                                                row.revealed
                                                    ? 'Hide secret'
                                                    : 'Show secret'
                                            "
                                            @click="
                                                row.revealed = !row.revealed
                                            "
                                        >
                                            <i
                                                :class="
                                                    row.revealed
                                                        ? 'fa fa-eye-slash'
                                                        : 'fa fa-eye'
                                                "
                                            ></i>
                                        </button>
                                    </div>
                                </td>
                                <td
                                    class="env-kv-delete"
                                    @click="removeEnvironmentRow(index)"
                                    v-if="!isBlankEnvironmentRow(row, index)"
                                >
                                    <i class="fa fa-trash"></i>
                                </td>
                                <td v-else></td>
                            </tr>
                        </table>
                    </div>
                    <div style="margin-top: 1rem">
                        <div v-if="parseError" class="box">
                            {{ parseError }}
                        </div>
                        <div class="box box-hidden" v-else>Spacer Text</div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div
                    style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    "
                >
                    <div
                        v-if="editorMode === 'secrets'"
                        style="
                            font-size: 0.75rem;
                            text-align: left;
                            line-height: 1rem;
                            margin-right: 0.5rem;
                        "
                    >
                        Secret values are referenced like other variables and
                        are sent with the request. They are masked in the URL
                        preview, history, and variable tooltips. Encrypt with
                        password stores them as encrypted JSON, apart from the
                        environment and left out of exports.
                    </div>
                    <div
                        v-else-if="editingGlobals"
                        style="
                            font-size: 0.75rem;
                            text-align: left;
                            line-height: 1rem;
                            margin-right: 0.5rem;
                        "
                    >
                        Globals are available in every request in this
                        workspace. The selected environment and folder
                        environments override a global of the same name.
                    </div>
                    <div
                        v-else
                        style="
                            font-size: 0.75rem;
                            text-align: left;
                            line-height: 1rem;
                            margin-right: 0.5rem;
                        "
                    >
                        <span v-pre
                            >Keys defined above can be referenced in any text
                            input in the request panel using
                            <span class="code">{{ key }}</span> for variable
                            substitution</span
                        >
                    </div>
                    <div>
                        <button class="button">Done</button>
                    </div>
                </div>
            </template>
        </modal>
        <template v-if="showEnvironmentContextMenuPopup">
            <div
                class="context-menu-background-overlay"
                @click="hideEnvironmentContextMenu()"
            ></div>
            <div
                class="context-menu"
                :style="{
                    top: showEnvironmentContextMenuPopupCoords.y,
                    left: showEnvironmentContextMenuPopupCoords.x,
                }"
            >
                <div @click="renameEnvironment">Rename</div>
                <div @click="changeEnvironmentColor">Change color</div>
                <div @click="setEnvironmentEmoji">
                    {{
                        readEnvironmentEmoji(clickedContextMenuEnvironment)
                            ? "Change emoji"
                            : "Set emoji"
                    }}
                </div>
                <div
                    v-if="readEnvironmentEmoji(clickedContextMenuEnvironment)"
                    @click="clearEnvironmentEmoji"
                >
                    Use color
                </div>
                <div @click="deleteEnvironment">Delete</div>
            </div>
        </template>
    </form>
    <EditTagModal
        v-if="editTagModalShow"
        v-model:showModal="editTagModalShow"
        :parsed-func="editTagParsedFunc"
        :update-func="editTagUpdateFunc"
    />
</template>

<script>
import Modal from "@/components/Modal.vue";
import CodeMirrorSingleLine from "@/components/CodeMirrorSingleLine.vue";
import EditTagModal from "@/components/modals/EditTagModal.vue";
import { nextTick } from "vue";
import { emitter } from "@/event-bus";
import constants from "@/constants";
import { jsonStringify } from "@/helpers";
import {
    applyPublicLayer,
    applySecretLayer,
    attachSecretPaths,
} from "@/utils/environment-secrets";
import { convertPostmanVariableValues } from "@/parsers/postman";
import { environmentEmoji, isSingleEmoji } from "@/utils/environment-marker";
import {
    environmentFromRows,
    rowsFromEnvironment,
} from "@/utils/environment-rows";
import {
    copySecretValues,
    createSecretSession,
    isEncryptedSecrets,
    lockSecretSession,
    mergedSecretValues,
    openEncryptedSecrets,
    revealedSecretValues,
    sealSecretValues,
    secretsUnlocked,
    unlockSecretSession,
} from "@/utils/secret-encryption";

export default {
    props: {
        showModal: Boolean,
        collectionItem: Object,
        workspace: Object,
    },
    components: {
        Modal,
        CodeMirrorSingleLine,
        EditTagModal,
    },
    data() {
        return {
            environment: "{}",
            rows: [],
            loadingRows: false,
            environmentToSave: {},
            parseError: "",
            clickedContextMenuEnvironment: { name: "" },
            showEnvironmentContextMenuPopup: false,
            showEnvironmentContextMenuPopupCoords: {
                x: "",
                y: "",
            },
            envVariables: {},
            editorMode: "variables",
            secretsPassword: "",
            secretsLocked: false,
            secretsEncrypted: false,
            secretsBusy: false,
            secretSaveTokens: {},
            editingGlobals: false,
            editTagModalShow: false,
            editTagParsedFunc: null,
            editTagUpdateFunc: null,
            draggedEnvironmentIndex: null,
        };
    },
    computed: {
        showModalComp: {
            get() {
                return this.showModal;
            },
            set(value) {
                if (this.parseError) {
                    this.$toast.error(
                        "Invalid JSON. Please fix the error before closing the editor.",
                    );
                    return;
                }

                this.$emit("update:showModal", value);
            },
        },
        environments() {
            if (this.collectionItem) {
                return (
                    this.collectionItem.environments ?? [
                        {
                            name: constants.DEFAULT_ENVIRONMENT.name,
                            environment: this.environmentToSave,
                            color: constants.DEFAULT_ENVIRONMENT.color,
                        },
                    ]
                );
            }

            if (this.workspace) {
                return (
                    this.workspace.environments ?? [
                        {
                            name: constants.DEFAULT_ENVIRONMENT.name,
                            environment: this.environmentToSave,
                            color: constants.DEFAULT_ENVIRONMENT.color,
                        },
                    ]
                );
            }

            return undefined;
        },
        currentEnvironment() {
            if (this.collectionItem) {
                return (
                    this.collectionItem.currentEnvironment ??
                    constants.DEFAULT_ENVIRONMENT.name
                );
            }

            if (this.workspace) {
                return (
                    this.workspace.currentEnvironment ??
                    constants.DEFAULT_ENVIRONMENT.name
                );
            }

            return undefined;
        },
        tagAutocompletions() {
            return constants.AUTOCOMPLETIONS.TAGS;
        },
    },
    watch: {
        collectionItem() {
            this.setEnvironmentText(
                this.collectionItem.environment
                    ? jsonStringify(this.collectionItem.environment)
                    : "{}",
            );
        },
        workspace() {
            this.setEnvironmentText(
                this.workspace.environment
                    ? jsonStringify(this.workspace.environment)
                    : "{}",
            );
        },
        environment() {
            let environment = {};
            try {
                environment = JSON.parse(this.environment);
                this.parseError = "";
            } catch (e) {
                this.parseError = e.message;
                return;
            }

            if (this.editingGlobals) {
                this.persistGlobals(environment);
                return;
            }

            if (this.editorMode === "secrets") {
                this.persistSecrets(environment);
                return;
            }

            this.environmentToSave = environment;
            this.saveEnvironment();
        },
        showModal() {
            if (this.showModal) {
                this.parseError = "";
                this.editingGlobals = false;
                this.editorMode = "variables";
                if (this.collectionItem) {
                    this.setEnvironmentText(
                        this.collectionItem.environment
                            ? jsonStringify(this.collectionItem.environment)
                            : "{}",
                    );
                }
                if (this.workspace) {
                    this.setEnvironmentText(
                        this.workspace.environment
                            ? jsonStringify(this.workspace.environment)
                            : "{}",
                    );
                }
                nextTick(() => {
                    this.$refs[
                        "environment-" + this.currentEnvironment
                    ][0].scrollIntoView({
                        behavior: "auto",
                        block: "center",
                        inline: "center",
                    });
                });

                this.loadEnvVariables();
            }
        },
    },
    methods: {
        async done() {
            this.showModalComp = false;
        },
        async addEnvironment(
            newEnvironmentName = undefined,
            environmentObject = undefined,
            secretsObject = undefined,
        ) {
            const isImport = environmentObject !== undefined;
            let isMerge = false;

            if (newEnvironmentName === undefined) {
                newEnvironmentName = await window.createPrompt(
                    "Enter new environment name",
                );

                if (!newEnvironmentName || newEnvironmentName.trim() === "") {
                    return;
                }
            }

            const environmentColor = await window.createPrompt(
                "Choose a color for the environment",
                constants.DEFAULT_ENVIRONMENT.color,
            );

            if (
                this.environments.some(
                    (environment) => environment.name === newEnvironmentName,
                )
            ) {
                if (!isImport) {
                    this.$toast.error(
                        `Given environment name already exists: ${newEnvironmentName}`,
                    );
                    return;
                } else {
                    if (
                        !(await window.createConfirm(
                            `Given environment name already exists: ${newEnvironmentName}\nDo you want to merge with the existing one?`,
                        ))
                    ) {
                        return;
                    }

                    isMerge = true;
                }
            }

            let environment = {
                name: newEnvironmentName,
                color: environmentColor || constants.DEFAULT_ENVIRONMENT.color,
                environment: {},
            };

            if (!isMerge) {
                if (environmentObject !== undefined) {
                    environment.environment = environmentObject;
                }

                if (
                    secretsObject !== undefined &&
                    Object.keys(secretsObject).length > 0
                ) {
                    environment.secrets = secretsUnlocked()
                        ? await sealSecretValues(secretsObject)
                        : secretsObject;
                }

                if (this.collectionItem) {
                    if (!("environments" in this.collectionItem)) {
                        this.collectionItem.environments = [
                            {
                                name: constants.DEFAULT_ENVIRONMENT.name,
                                color: constants.DEFAULT_ENVIRONMENT.color,
                                environment: this.environmentToSave,
                            },
                        ];
                    }
                    this.collectionItem.environments.push(environment);
                }

                if (this.workspace) {
                    if (!("environments" in this.workspace)) {
                        this.workspace.environments = [
                            {
                                name: constants.DEFAULT_ENVIRONMENT.name,
                                color: constants.DEFAULT_ENVIRONMENT.color,
                                environment: this.environmentToSave,
                            },
                        ];
                    }
                    this.workspace.environments.push(environment);
                }
            } else {
                const existingEnvironment = this.environments.find(
                    (environment) => environment.name === newEnvironmentName,
                );
                existingEnvironment.environment = {
                    ...existingEnvironment.environment,
                    ...environmentObject,
                };
                if (
                    secretsObject !== undefined &&
                    Object.keys(secretsObject).length > 0
                ) {
                    const merged = await mergedSecretValues(
                        existingEnvironment.secrets,
                        secretsObject,
                    );
                    if (merged === "locked") {
                        this.$toast.error(
                            "Unlock secrets before importing into them",
                        );
                        return;
                    }
                    existingEnvironment.secrets = merged;
                }
                environment = existingEnvironment;
            }

            this.changeEnvironment(environment);

            nextTick(() => {
                this.$refs["environment-" + environment.name][0].scrollIntoView(
                    {
                        behavior: "auto",
                        block: "center",
                        inline: "center",
                    },
                );
            });
        },
        changeEnvironment(environment) {
            if (this.parseError) {
                this.$toast.error(
                    "Invalid JSON. Please fix the error before switching.",
                );
                return;
            }

            this.editingGlobals = false;

            if (this.collectionItem) {
                this.collectionItem.currentEnvironment = environment.name;
            }

            if (this.workspace) {
                this.workspace.currentEnvironment = environment.name;
            }

            this.saveCurrentEnvironment();

            let environmentSource =
                this.editorMode === "secrets"
                    ? (environment.secrets ?? {})
                    : environment.environment;
            if (this.editorMode === "secrets") {
                const plain = this.syncSecretEditor(environmentSource);
                if (plain === null) {
                    return;
                }
                environmentSource = plain;
            }
            const environmentString = jsonStringify(environmentSource);

            let manuallyTriggerSave = false;

            // environment watch doesn't trigger when value is same as before,
            // so we need to do this trick, to save the new environment
            if (environmentString === this.environment) {
                manuallyTriggerSave = true;
            }

            this.setEnvironmentText(environmentString);

            if (manuallyTriggerSave) {
                const parsed = JSON.parse(this.environment);
                if (this.editorMode === "secrets") {
                    this.persistSecrets(parsed);
                } else {
                    this.environmentToSave = parsed;
                    this.saveEnvironment();
                }
            }
        },
        editGlobals() {
            if (!this.workspace) {
                return;
            }

            if (this.parseError) {
                this.$toast.error(
                    "Invalid JSON. Please fix the error before switching.",
                );
                return;
            }

            this.editingGlobals = true;
            let source =
                this.editorMode === "secrets"
                    ? (this.workspace.globalSecrets ?? {})
                    : (this.workspace.globals ?? {});
            if (this.editorMode === "secrets") {
                const plain = this.syncSecretEditor(source);
                if (plain === null) {
                    return;
                }
                source = plain;
            }
            this.setEnvironmentText(jsonStringify(source));
        },
        setEditorMode(mode) {
            if (this.editorMode === mode) {
                return;
            }

            if (this.parseError) {
                this.$toast.error(
                    "Invalid JSON. Please fix the error before switching.",
                );
                return;
            }

            this.editorMode = mode;
            this.loadEditorText();
        },
        loadEditorText() {
            let source = {};

            if (this.editingGlobals) {
                source =
                    this.editorMode === "secrets"
                        ? (this.workspace.globalSecrets ?? {})
                        : (this.workspace.globals ?? {});
            } else {
                const current = this.environments?.find(
                    (environment) =>
                        environment.name === this.currentEnvironment,
                );
                source =
                    this.editorMode === "secrets"
                        ? (current?.secrets ?? {})
                        : (current?.environment ??
                          this.environmentToSave ??
                          {});
            }

            if (this.editorMode === "secrets") {
                const plain = this.syncSecretEditor(source);
                if (plain === null) {
                    return;
                }
                source = plain;
            }

            this.setEnvironmentText(jsonStringify(source));
        },
        setEnvironmentText(text) {
            const next = text && text.trim() !== "" ? text : "{}";
            this.loadingRows = true;

            let parsed = {};
            try {
                parsed = JSON.parse(next);
            } catch {
                parsed = {};
            }

            this.rows = rowsFromEnvironment(parsed).map((row) => ({
                ...row,
                id: this.nextRowId(),
            }));
            this.ensureBlankRow();
            this.environment = next;
            nextTick(() => {
                this.loadingRows = false;
            });
        },
        nextRowId() {
            this.rowId = (this.rowId ?? 0) + 1;
            return this.rowId;
        },
        ensureBlankRow() {
            const last = this.rows[this.rows.length - 1];
            if (!last || last.key !== "" || last.value !== "") {
                this.rows.push({
                    id: this.nextRowId(),
                    key: "",
                    value: "",
                    stored: undefined,
                });
            }
        },
        isBlankEnvironmentRow(row, index) {
            return (
                index === this.rows.length - 1 &&
                row.key === "" &&
                row.value === ""
            );
        },
        onEnvironmentRowInput() {
            if (this.loadingRows) {
                return;
            }

            this.ensureBlankRow();
            const next = jsonStringify(environmentFromRows(this.rows));
            if (next === this.environment) {
                return;
            }

            this.environment = next;
        },
        removeEnvironmentRow(index) {
            this.rows.splice(index, 1);
            this.ensureBlankRow();
            this.environment = jsonStringify(environmentFromRows(this.rows));
        },
        activeWorkspaceForSecrets() {
            return this.workspace ?? this.$store.state.activeWorkspace;
        },
        anyBagEncrypted() {
            return this.secretBagRefs().some((ref) =>
                isEncryptedSecrets(ref.get()),
            );
        },
        secretBagRefs() {
            const refs = [];
            const workspace = this.activeWorkspaceForSecrets();
            if (workspace) {
                refs.push({
                    role: "globals",
                    get: () => workspace.globalSecrets,
                    set: (value) => {
                        workspace.globalSecrets = value;
                    },
                });
                for (const environment of workspace.environments ?? []) {
                    refs.push({
                        role: "environment",
                        get: () => environment.secrets,
                        set: (value) => {
                            environment.secrets = value;
                        },
                    });
                }
            }

            for (const item of this.$store.state.collection ?? []) {
                if (item._type !== "request_group" || !item.environments) {
                    continue;
                }
                for (const environment of item.environments) {
                    refs.push({
                        role: "environment",
                        get: () => environment.secrets,
                        set: (value) => {
                            environment.secrets = value;
                        },
                    });
                }
            }

            return refs;
        },
        commitSecretBags() {
            const workspace = this.activeWorkspaceForSecrets();
            if (workspace?.globalSecrets) {
                this.$store.commit("updateWorkspaceGlobalSecrets", {
                    workspaceId: workspace._id,
                    globalSecrets: workspace.globalSecrets,
                });
            }
            if (workspace?.environments) {
                this.$store.commit("updateWorkspaceEnvironments", {
                    workspaceId: workspace._id,
                    environments: workspace.environments,
                });
            }

            for (const item of this.$store.state.collection ?? []) {
                if (item._type !== "request_group" || !item.environments) {
                    continue;
                }
                if (
                    !item.environments.some(
                        (environment) => environment.secrets,
                    )
                ) {
                    continue;
                }
                this.$store.commit("updateCollectionItemEnvironments", {
                    collectionId: item._id,
                    environments: item.environments,
                });
            }

            this.$store.dispatch("reloadTabEnvironmentResolved");
        },
        syncSecretEditor(stored) {
            this.secretsEncrypted = secretsUnlocked() || this.anyBagEncrypted();
            if (!secretsUnlocked() && this.secretsEncrypted) {
                this.showLockedSecrets();
                return null;
            }

            this.secretsLocked = false;
            if (isEncryptedSecrets(stored)) {
                return revealedSecretValues(stored) ?? {};
            }

            return stored ?? {};
        },
        showLockedSecrets() {
            this.secretsLocked = true;
            this.secretsEncrypted = true;
            this.loadingRows = true;
            this.rows = [];
            this.environment = "{}";
            nextTick(() => {
                this.loadingRows = false;
            });
        },
        async askNewPassword() {
            const password = await window.createPrompt(
                "Encrypt secrets",
                "",
                [],
                { label: "Password", mask: true },
            );
            if (password === null) {
                return null;
            }
            if (password.length < 8) {
                this.$toast.error("Use at least 8 characters");
                return null;
            }

            const confirmPassword = await window.createPrompt(
                "Encrypt secrets",
                "",
                [],
                { label: "Confirm password", mask: true },
            );
            if (confirmPassword === null) {
                return null;
            }
            if (confirmPassword !== password) {
                this.$toast.error("Passwords do not match");
                return null;
            }

            return password;
        },
        async enableSecretEncryption() {
            const password = await this.askNewPassword();
            if (!password) {
                return;
            }

            this.secretsBusy = true;
            try {
                await createSecretSession(password);
                for (const ref of this.secretBagRefs()) {
                    const existing = ref.get();
                    const plain = isEncryptedSecrets(existing)
                        ? revealedSecretValues(existing)
                        : existing &&
                            typeof existing === "object" &&
                            !Array.isArray(existing)
                          ? existing
                          : {};
                    if (!plain) {
                        continue;
                    }
                    if (
                        ref.role !== "globals" &&
                        Object.keys(plain).length === 0
                    ) {
                        continue;
                    }
                    ref.set(await sealSecretValues(plain));
                }
                this.commitSecretBags();
                this.secretsEncrypted = true;
                this.secretsLocked = false;
                this.loadEditorText();
                this.$toast.success("Secrets encrypted");
            } finally {
                this.secretsBusy = false;
            }
        },
        async unlockSecretsFromPassword() {
            const password = this.secretsPassword;
            if (!password) {
                return;
            }

            const sample = this.secretBagRefs()
                .map((ref) => ref.get())
                .find((secrets) => isEncryptedSecrets(secrets));
            if (!sample) {
                return;
            }

            this.secretsBusy = true;
            try {
                const unlocked = await unlockSecretSession(password, sample);
                this.secretsPassword = "";
                if (!unlocked) {
                    this.$toast.error("Wrong password");
                    return;
                }

                let failed = false;
                for (const ref of this.secretBagRefs()) {
                    const existing = ref.get();
                    if (!isEncryptedSecrets(existing)) {
                        continue;
                    }
                    if (!(await openEncryptedSecrets(existing))) {
                        failed = true;
                    }
                }
                if (failed) {
                    this.$toast.error("Some secrets could not be decrypted");
                }
                this.secretsLocked = false;
                this.secretsEncrypted = true;
                this.loadEditorText();
                this.$store.dispatch("reloadTabEnvironmentResolved");
            } finally {
                this.secretsBusy = false;
            }
        },
        lockSecrets() {
            lockSecretSession();
            this.secretsPassword = "";
            this.showLockedSecrets();
            this.$store.dispatch("reloadTabEnvironmentResolved");
        },
        async changeSecretPassword() {
            const password = await this.askNewPassword();
            if (!password) {
                return;
            }

            this.secretsBusy = true;
            try {
                const snapshots = [];
                for (const ref of this.secretBagRefs()) {
                    const existing = ref.get();
                    if (isEncryptedSecrets(existing)) {
                        const plain = revealedSecretValues(existing);
                        if (!plain) {
                            this.$toast.error(
                                "Unlock secrets before changing the password",
                            );
                            return;
                        }
                        snapshots.push({
                            ref,
                            plain: copySecretValues(plain),
                        });
                        continue;
                    }
                    if (
                        !existing ||
                        typeof existing !== "object" ||
                        Array.isArray(existing) ||
                        (ref.role !== "globals" &&
                            Object.keys(existing).length === 0)
                    ) {
                        continue;
                    }
                    snapshots.push({
                        ref,
                        plain: copySecretValues(existing),
                    });
                }

                await createSecretSession(password);
                for (const snapshot of snapshots) {
                    snapshot.ref.set(await sealSecretValues(snapshot.plain));
                }
                this.commitSecretBags();
                this.secretsEncrypted = true;
                this.secretsLocked = false;
                this.loadEditorText();
                this.$toast.success("Password changed");
            } finally {
                this.secretsBusy = false;
            }
        },
        async removeSecretEncryption() {
            if (
                !(await window.createConfirm(
                    "Remove encryption? Secret values will be stored without a password.",
                    "Remove",
                ))
            ) {
                return;
            }

            const snapshots = [];
            for (const ref of this.secretBagRefs()) {
                const existing = ref.get();
                if (!isEncryptedSecrets(existing)) {
                    continue;
                }
                const plain = revealedSecretValues(existing);
                if (!plain) {
                    this.$toast.error(
                        "Unlock secrets before removing encryption",
                    );
                    return;
                }
                snapshots.push({ ref, plain: copySecretValues(plain) });
            }

            lockSecretSession();
            for (const snapshot of snapshots) {
                snapshot.ref.set(snapshot.plain);
            }
            this.commitSecretBags();
            this.secretsEncrypted = false;
            this.secretsLocked = false;
            this.secretsPassword = "";
            this.loadEditorText();
            this.$toast.success("Encryption removed");
        },
        persistGlobals(value) {
            if (this.editorMode === "secrets") {
                if (this.secretsLocked) {
                    return;
                }

                const token = (this.secretSaveTokens.globals ?? 0) + 1;
                this.secretSaveTokens.globals = token;
                void sealSecretValues(value).then((stored) => {
                    if (this.secretSaveTokens.globals !== token) {
                        return;
                    }

                    this.workspace.globalSecrets = stored;
                    this.$store.commit("updateWorkspaceGlobalSecrets", {
                        workspaceId: this.workspace._id,
                        globalSecrets: stored,
                    });
                    this.$store.dispatch("reloadTabEnvironmentResolved");
                    this.loadEnvVariables();
                });
                return;
            } else {
                this.workspace.globals = value;
                this.$store.commit("updateWorkspaceGlobals", {
                    workspaceId: this.workspace._id,
                    globals: value,
                });
            }

            this.$store.dispatch("reloadTabEnvironmentResolved");
            this.loadEnvVariables();
        },
        persistSecrets(value) {
            if (this.secretsLocked) {
                return;
            }

            if (this.collectionItem && !this.collectionItem.environments) {
                this.collectionItem.environments = this.environments;
            }

            if (this.workspace && !this.workspace.environments) {
                this.workspace.environments = this.environments;
            }

            const environmentName = this.currentEnvironment;
            const token = (this.secretSaveTokens[environmentName] ?? 0) + 1;
            this.secretSaveTokens[environmentName] = token;
            void sealSecretValues(value).then((stored) => {
                if (this.secretSaveTokens[environmentName] !== token) {
                    return;
                }

                const current = this.environments.find(
                    (environment) => environment.name === environmentName,
                );
                if (!current) {
                    return;
                }

                current.secrets = stored;
                this.saveEnvironments();
            });
        },
        onDragStart(index, event) {
            this.draggedEnvironmentIndex = index;
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", index);
            }
        },
        onDrop(dropIndex) {
            if (
                this.draggedEnvironmentIndex === null ||
                this.draggedEnvironmentIndex === dropIndex
            ) {
                return;
            }

            const draggedItem = this.environments.splice(
                this.draggedEnvironmentIndex,
                1,
            )[0];
            this.environments.splice(dropIndex, 0, draggedItem);
            this.saveEnvironments();
            this.draggedEnvironmentIndex = null;
        },
        onDragEnd() {
            this.draggedEnvironmentIndex = null;
        },
        saveEnvironment() {
            if (this.collectionItem) {
                this.collectionItem.environment = this.environmentToSave;
                this.$store.commit("updateCollectionItemEnvironment", {
                    collectionId: this.collectionItem._id,
                    environment: this.environmentToSave,
                });
            }

            if (this.workspace) {
                this.workspace.environment = this.environmentToSave;
                this.$store.commit("updateWorkspaceEnvironment", {
                    workspaceId: this.workspace._id,
                    environment: this.environmentToSave,
                });
            }

            const currentEnvironment = this.environments.find(
                (environmentItem) =>
                    environmentItem.name === this.currentEnvironment,
            );
            currentEnvironment.environment = this.environmentToSave;

            this.saveEnvironments();
        },
        saveEnvironments() {
            // a fresh workspace / folder has no environments array yet (missing or undefined), so the computed builds a temporary one;
            // attach it before saving, otherwise the in-memory item stays without environments until reload
            // and a following import merges against an empty list and overwrites the saved default environment
            if (this.collectionItem && !this.collectionItem.environments) {
                this.collectionItem.environments = this.environments;
            }

            if (this.workspace && !this.workspace.environments) {
                this.workspace.environments = this.environments;
            }

            if (this.collectionItem) {
                this.$store.commit("updateCollectionItemEnvironments", {
                    collectionId: this.collectionItem._id,
                    environments: this.environments,
                });
            }

            if (this.workspace) {
                console.log(
                    "updating workspace environments",
                    this.environments,
                );
                this.$store.commit("updateWorkspaceEnvironments", {
                    workspaceId: this.workspace._id,
                    environments: this.environments,
                });
            }

            this.$store.dispatch("reloadTabEnvironmentResolved");
        },
        saveCurrentEnvironment() {
            if (this.collectionItem) {
                this.$store.commit("updateCollectionItemCurrentEnvironment", {
                    collectionId: this.collectionItem._id,
                    currentEnvironment: this.currentEnvironment,
                });
            }

            if (this.workspace) {
                this.$store.commit("updateWorkspaceCurrentEnvironment", {
                    workspaceId: this.workspace._id,
                    currentEnvironment: this.currentEnvironment,
                });
            }
        },
        showEnvironmentContextMenu(event, environment) {
            if (
                this.clickedContextMenuEnvironment.name === environment.name &&
                this.showEnvironmentContextMenuPopup === true
            ) {
                this.hideEnvironmentContextMenu();
                return;
            }
            const menuElement = event.target;
            var clientRect = menuElement.getBoundingClientRect();
            var clientX = clientRect.left;
            var clientY = clientRect.top;
            this.clickedContextMenuEnvironment = environment;
            this.showEnvironmentContextMenuPopupCoords.x = clientX + "px";
            this.showEnvironmentContextMenuPopupCoords.y =
                clientY + clientRect.height + 5 + "px";
            this.showEnvironmentContextMenuPopup = true;
        },
        hideEnvironmentContextMenu(clearClickedContextMenuEnvironment = true) {
            if (this.showEnvironmentContextMenuPopup === false) {
                return;
            }
            this.showEnvironmentContextMenuPopup = false;
            if (clearClickedContextMenuEnvironment) {
                this.clickedContextMenuEnvironment = { name: "" };
            }
        },
        async renameEnvironment() {
            const newEnvironmentName = await window.createPrompt(
                "Enter new environment name",
                this.clickedContextMenuEnvironment.name,
            );

            if (!newEnvironmentName || newEnvironmentName.trim() === "") {
                this.hideEnvironmentContextMenu();
                return;
            }

            if (
                this.clickedContextMenuEnvironment.name !==
                    newEnvironmentName &&
                this.environments.some(
                    (environment) => environment.name === newEnvironmentName,
                )
            ) {
                this.$toast.error("Given environment name already exists");
                this.hideEnvironmentContextMenu();
                return;
            }

            // we need this to re set current environment if the changed
            // environment name is the current environment
            let changeCurrentEnvironment = false;

            if (
                this.clickedContextMenuEnvironment.name ===
                this.currentEnvironment
            ) {
                changeCurrentEnvironment = true;
            }

            this.clickedContextMenuEnvironment.name = newEnvironmentName;

            if (this.workspace && "environments" in this.workspace === false) {
                this.workspace.environments = this.environments;
            }

            if (
                this.collectionItem &&
                "environments" in this.collectionItem === false
            ) {
                this.collectionItem.environments = this.environments;
            }

            this.saveEnvironments();

            if (changeCurrentEnvironment) {
                this.changeEnvironment(this.clickedContextMenuEnvironment);
            }

            this.hideEnvironmentContextMenu();
        },
        readEnvironmentEmoji(environment) {
            return environmentEmoji(environment);
        },
        rememberEnvironments() {
            if (this.workspace && "environments" in this.workspace === false) {
                this.workspace.environments = this.environments;
            }

            if (
                this.collectionItem &&
                "environments" in this.collectionItem === false
            ) {
                this.collectionItem.environments = this.environments;
            }
        },
        async setEnvironmentEmoji() {
            const picked = await window.createPrompt(
                "Choose an emoji for the environment",
                this.readEnvironmentEmoji(this.clickedContextMenuEnvironment) ??
                    "",
                [],
                { emoji: true },
            );

            if (picked === null) {
                this.hideEnvironmentContextMenu();
                return;
            }

            const emoji = typeof picked === "string" ? picked.trim() : "";
            if (!isSingleEmoji(emoji)) {
                this.$toast.error("Enter a single emoji");
                this.hideEnvironmentContextMenu();
                return;
            }

            this.clickedContextMenuEnvironment.emoji = emoji;
            this.rememberEnvironments();
            this.saveEnvironments();
            this.hideEnvironmentContextMenu();
        },
        clearEnvironmentEmoji() {
            delete this.clickedContextMenuEnvironment.emoji;
            this.rememberEnvironments();
            this.saveEnvironments();
            this.hideEnvironmentContextMenu();
        },
        async changeEnvironmentColor() {
            const newEnvironmentColor = await window.createPrompt(
                "Choose another color for your environment",
                this.clickedContextMenuEnvironment.color,
            );

            this.clickedContextMenuEnvironment.color = newEnvironmentColor;
            this.rememberEnvironments();

            this.saveEnvironments();

            this.hideEnvironmentContextMenu();
        },
        async deleteEnvironment() {
            if (this.environments.length === 1) {
                this.$toast.error(
                    "Cannot delete environment as there's only one environment left",
                );
                this.hideEnvironmentContextMenu();
                return;
            }

            if (
                !(await window.createConfirm(
                    "Are you sure you want to delete this environment?",
                ))
            ) {
                this.hideEnvironmentContextMenu();
                return;
            }

            if (this.collectionItem) {
                this.collectionItem.environments = this.environments.filter(
                    (environment) =>
                        environment.name !==
                        this.clickedContextMenuEnvironment.name,
                );
            }

            if (this.workspace) {
                this.workspace.environments = this.environments.filter(
                    (environment) =>
                        environment.name !==
                        this.clickedContextMenuEnvironment.name,
                );
            }

            this.saveEnvironments();

            if (
                this.clickedContextMenuEnvironment.name ===
                this.currentEnvironment
            ) {
                this.changeEnvironment(this.environments[0]);
            }

            this.hideEnvironmentContextMenu();
        },
        importEnvironment() {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json";
            fileInput.style.display = "none";
            fileInput.addEventListener("change", async () => {
                const file = fileInput.files[0];
                if (!file) {
                    return;
                }
                const fileContents = await file.text();
                try {
                    const parsedJSON = JSON.parse(fileContents);
                    let environment = {};

                    let secrets;

                    if (
                        "_postman_variable_scope" in parsedJSON &&
                        (parsedJSON._postman_variable_scope === "environment" ||
                            parsedJSON._postman_variable_scope === "globals")
                    ) {
                        const converted = convertPostmanVariableValues(
                            parsedJSON.values,
                        );
                        environment = converted.environment;
                        secrets = converted.secrets;

                        if (parsedJSON._postman_variable_scope === "globals") {
                            const workspace =
                                this.workspace ??
                                this.$store.state.activeWorkspace;
                            if (workspace) {
                                if (Object.keys(environment).length > 0) {
                                    workspace.globals = {
                                        ...(workspace.globals ?? {}),
                                        ...environment,
                                    };
                                    this.$store.commit(
                                        "updateWorkspaceGlobals",
                                        {
                                            workspaceId: workspace._id,
                                            globals: workspace.globals,
                                        },
                                    );
                                }
                                if (Object.keys(secrets).length > 0) {
                                    const merged = await mergedSecretValues(
                                        workspace.globalSecrets,
                                        secrets,
                                    );
                                    if (merged === "locked") {
                                        this.$toast.error(
                                            "Unlock secrets before importing into them",
                                        );
                                        return;
                                    }
                                    workspace.globalSecrets = merged;
                                    this.$store.commit(
                                        "updateWorkspaceGlobalSecrets",
                                        {
                                            workspaceId: workspace._id,
                                            globalSecrets:
                                                workspace.globalSecrets,
                                        },
                                    );
                                }
                                this.$store.dispatch(
                                    "reloadTabEnvironmentResolved",
                                );
                                this.$toast.success(
                                    "Imported global variables",
                                );
                                if (this.workspace) {
                                    this.editGlobals();
                                }
                            }
                            return;
                        }
                    } else {
                        environment = parsedJSON.environment;
                    }

                    this.addEnvironment(parsedJSON.name, environment, secrets);
                } catch (e) {
                    this.$toast.error("Invalid JSON file");
                } finally {
                    document.body.removeChild(fileInput);
                }
            });
            document.body.appendChild(fileInput);
            fileInput.click();
        },
        exportEnvironment() {
            if (this.editingGlobals) {
                const blob = new Blob(
                    [
                        jsonStringify({
                            name: "Globals",
                            environment: this.workspace.globals ?? {},
                        }),
                    ],
                    { type: "application/json" },
                );
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "Globals.restfox_environment.json";
                link.click();
                return;
            }

            const environment = this.environments.find(
                (environment) => environment.name === this.currentEnvironment,
            );
            const exported = { ...environment };
            delete exported.secrets;
            const blob = new Blob([jsonStringify(exported)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${environment.name}.restfox_environment.json`;
            link.click();
        },
        async loadEnvVariables() {
            if (this.collectionItem) {
                const request = JSON.parse(JSON.stringify(this.collectionItem));
                const { environment } = await this.$store.dispatch(
                    "getEnvironmentForRequest",
                    { collectionItem: request },
                );
                this.envVariables = environment;
            } else if (this.workspace) {
                const secretPaths = new Set();
                const current = (this.workspace.environments ?? []).find(
                    (environment) =>
                        environment.name ===
                        (this.workspace.currentEnvironment ??
                            constants.DEFAULT_ENVIRONMENT.name),
                );
                this.envVariables = {};
                applyPublicLayer(
                    this.envVariables,
                    this.workspace.globals,
                    secretPaths,
                );
                applySecretLayer(
                    this.envVariables,
                    this.workspace.globalSecrets,
                    secretPaths,
                );
                applyPublicLayer(
                    this.envVariables,
                    current?.environment ?? this.workspace.environment,
                    secretPaths,
                );
                applySecretLayer(
                    this.envVariables,
                    current?.secrets,
                    secretPaths,
                );
                attachSecretPaths(this.envVariables, secretPaths);

                if (this.workspace._type === "file" && this.workspace.dotEnv) {
                    Object.keys(this.workspace.dotEnv).forEach((dotEnvKey) => {
                        // this varName array join trick is needed as vite build changes all strings that match process.env to {}
                        const varName = ["process", "env", dotEnvKey].join(".");
                        this.envVariables[varName] =
                            this.workspace.dotEnv[dotEnvKey];
                    });
                }
            }
        },
        handleCollectionItemEvent(event) {
            // close the modal if the parent is no more
            // doesn't matter for which collection item - it could be the parent, sibling or grandparent
            // too much work to figure out which one it is, so just close the modal
            if (this.collectionItem && event.name === "deleted") {
                this.showModalComp = false;
            }
        },
        handleEnvironmentEvent(event) {
            // close open environment modal if the environment is added, updated or deleted
            // doesn't matter for which collection item or if workspace
            if (
                event.name === "added" ||
                event.name === "updated" ||
                event.name === "deleted"
            ) {
                this.showModalComp = false;
            }
        },
        handleDotEnvEvent(event) {
            if (event === "reloaded") {
                this.loadEnvVariables();
            }
        },
        onTagClick(parsedFunc, updateFunc) {
            this.editTagParsedFunc = parsedFunc;
            this.editTagUpdateFunc = updateFunc;
            this.editTagModalShow = true;
        },
    },
    created() {
        emitter.on("collectionItem", this.handleCollectionItemEvent);
        emitter.on("environment", this.handleEnvironmentEvent);
        emitter.on("dotenv", this.handleDotEnvEvent);
    },
    beforeUnmount() {
        emitter.off("collectionItem", this.handleCollectionItemEvent);
        emitter.off("environment", this.handleEnvironmentEvent);
        emitter.off("dotenv", this.handleDotEnvEvent);
    },
};
</script>

<style scoped>
.box {
    padding: 0.6rem;
    border: 1px dotted #d04444;
    border-radius: 0.3rem;
}

.box-hidden {
    border: 1px dotted transparent;
    visibility: hidden;
}

.environment-sidebar-item {
    display: flex;
    padding-top: 0.3rem;
    padding-bottom: 0.3rem;
    padding-left: 0.3rem;
    padding-right: 0.3rem;
    cursor: pointer;
    justify-content: space-between;
    align-items: center;
}

.environment-sidebar-item-active {
    background-color: rgb(104 114 254 / 26%);
}

.environment-sidebar-item > .environment-sidebar-item-menu {
    visibility: hidden;
    border-radius: 10px;
    height: 1.4rem;
}

.environment-sidebar-item:hover > .environment-sidebar-item-menu,
.environment-sidebar-item
    > .environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
    visibility: visible;
}

.environment-sidebar-item.environment-sidebar-item-selected
    > .environment-sidebar-item-menu
    svg {
    fill: white;
}

.environment-sidebar-item > .environment-sidebar-item-menu:hover,
.environment-sidebar-item
    > .environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
    background-color: rgba(240, 248, 255, 0.233);
}

.environment-sidebar-item:not(.environment-sidebar-item-selected)
    > .environment-sidebar-item-menu:hover,
.environment-sidebar-item:not(.environment-sidebar-item-selected)
    > .environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
    background-color: rgb(108 194 197 / 20%);
}

.context-menu-background-overlay {
    position: fixed;
    z-index: 10;
    height: 100vh;
    width: 100vw;
    top: 0;
    left: 0;
}

.context-menu {
    position: fixed;
    z-index: 10;
    top: 0;
    left: 0;
    background-color: var(--modal-background-color);
    color: var(--modal-text-color);
    border-radius: 5px;
    box-shadow: 1px 1px 8px -4px black;
}

.context-menu > div {
    padding: 0.3rem 0.5rem;
    cursor: pointer;
}

.context-menu > div:hover {
    background-color: slateblue;
    color: white;
}

.environment-emoji {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    margin-right: 0.5rem;
    line-height: 1;
}

.ml-1rem {
    margin-left: 1rem;
}

.env-body {
    display: grid;
    grid-template-columns: auto 1fr;
    height: 100%;
    overflow: auto;
}

.env-sidebar-col {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    overflow: auto;
    margin-right: 1rem;
    border-right: 1px solid var(--modal-border-color);
}

.env-editor-col {
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: auto;
}

.env-kv-editor {
    overflow: auto;
    min-height: 0;
}

.env-kv-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
}

.env-kv-table th {
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0 0.35rem 0.35rem;
}

.env-kv-table th:first-child {
    width: 34%;
}

.env-kv-table th:last-child,
.env-kv-table td:last-child {
    width: 2rem;
}

.env-kv-table td {
    padding: 0.15rem 0.25rem;
    vertical-align: middle;
}

.env-kv-delete {
    text-align: center;
    cursor: pointer;
}

.env-kv-value {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.env-kv-value .code-mirror-single-line,
.env-kv-secret {
    flex: 1;
    min-width: 0;
}

.env-kv-secret {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--input-border-color);
    border-radius: var(--default-border-radius);
    background: var(--modal-background-color);
    color: var(--text-color);
    padding: 0.35rem 0.45rem;
    font: inherit;
}

.env-kv-secret:focus {
    outline: 1px solid var(--input-highlight-outline-color);
}

.env-kv-reveal {
    flex: none;
    border: 0;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
    padding: 0.2rem 0.35rem;
}

.env-secrets-lock,
.env-secrets-locked,
.env-secrets-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.env-secrets-lock {
    margin-bottom: 0.75rem;
}

.env-secrets-locked .env-kv-secret {
    flex: 1;
    min-width: 12rem;
    max-width: 20rem;
}

.env-secrets-state {
    font-size: 0.75rem;
}

.env-editor-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.env-editor-tab-active {
    box-shadow: inset 0 -2px 0 var(--text-color);
}

.environment-sidebar-divider {
    height: 1px;
    background: var(--modal-border-color);
    margin: 0.4rem 0.3rem;
}

@media (max-width: 768px) {
    .env-body {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
        height: auto;
        min-height: 100%;
    }

    .env-sidebar-col {
        height: auto;
        max-height: 150px;
        margin-right: 0;
        border-right: none;
        border-bottom: 1px solid var(--modal-border-color);
        padding-bottom: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .env-editor-col {
        min-height: 200px;
    }
}
</style>
