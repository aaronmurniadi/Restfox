<template>
    <form @submit.prevent="createWorkspace" v-if="showModalComp">
        <modal :title="!workspace ? 'New Workspace' : 'Workspace Properties'" v-model="showModalComp">
            <label>
                <div style="font-weight: 500; margin-bottom: var(--label-margin-bottom)">Name</div>
                <input type="text" class="full-width-input" v-model="workspaceName" :placeholder="!workspace ? 'New Workspace' : 'Workspace Name'" required spellcheck="false" v-focus>
            </label>

            <template v-if="isFileWorkspaceSupported && !githubSession">
                <div style="margin-top: 1rem">
                    <label>
                        <div style="font-weight: 500; margin-bottom: var(--label-margin-bottom)">Type</div>
                        <select class="full-width-input" v-model="workspaceType" :disabled="workspace">
                            <option v-for="workspaceTypeItem in workspaceTypes" :value="workspaceTypeItem.value">{{ workspaceTypeItem.label }}</option>
                        </select>
                    </label>
                </div>

                <div style="margin-top: 1rem" v-if="workspaceType === 'file'">
                    <label>
                        <div style="font-weight: 500; margin-bottom: var(--label-margin-bottom)">Choose a folder</div>
                        <div style="display: flex;">
                            <input type="text" class="full-width-input" v-model="workspaceLocation" placeholder="Folder Path" required spellcheck="false">
                            <button class="button" type="button" @click="showFolderBrowser = true">Browse</button>
                        </div>
                    </label>
                    <div style="margin-top: 0.5rem">Provide an empty folder or select a folder with an existing workspace</div>
                </div>
            </template>

            <p v-else-if="githubSession" style="margin-top: 1rem; opacity: 0.8; line-height: 1.4;">
                Workspace will be stored under <span class="code">workspaces/</span> in your private GitHub repository ({{ githubSession.repo.fullName }}) and synced when you Sync.
            </p>

            <template #footer>
                <button class="button" v-if="!workspace">Create</button>
                <button class="button" v-else>Update</button>
            </template>
        </modal>
    </form>

    <folder-browser-modal v-if="showFolderBrowser" v-model:showModal="showFolderBrowser" :initial-path="workspaceLocation" @folder-selected="workspaceLocation = $event" />
</template>

<script>
import Modal from '@/components/Modal.vue'
import FolderBrowserModal from '@/components/modals/FolderBrowserModal.vue'
import { fileIPC } from '@/db'

export default {
    directives: {
        focus: {
            mounted(element, binding) {
                element.focus()
                if(!binding.instance.workspace) {
                    element.select()
                }
            }
        }
    },
    props: {
        showModal: Boolean,
        workspace: {
            type: Object,
            required: false
        },
        isFileWorkspaceSupported: {
            type: Boolean,
            default: false
        },
    },
    components: {
        Modal,
        FolderBrowserModal,
    },
    data() {
        return {
            workspaceName: 'New Workspace',
            workspaceType: 'local',
            workspaceLocation: '',
            showFolderBrowser: false,
            workspaceTypes: [
                { label: 'In Filesystem (Git Friendly)', value: 'file' },
                { label: 'In Application', value: 'local' }
            ]
        }
    },
    computed: {
        showModalComp: {
            get() {
                return this.showModal
            },
            set(value) {
                this.$emit('update:showModal', value)
            }
        },
        githubSession() {
            return this.$store.state.githubSession
        },
    },
    watch: {
        workspace() {
            if(this.workspace) {
                this.workspaceName = this.workspace.name
                this.workspaceType = this.workspace._type ?? 'local'
                if(this.workspace._type === 'file') {
                    this.workspaceLocation = this.workspace.location
                } else {
                    this.workspaceLocation = ''
                }
            }
        },
        showModal() {
            if(this.showModal && this.workspace === undefined) {
                this.workspaceName = 'New Workspace'
                if(this.githubSession) {
                    this.workspaceType = 'github'
                } else if(this.isFileWorkspaceSupported) {
                    this.workspaceType = 'file'
                } else {
                    this.workspaceType = 'local'
                }
                this.workspaceLocation = ''
            }
        },
        async workspaceLocation() {
            if(this.workspaceLocation) {
                this.getSetWorkspaceName()
            }
        }
    },
    methods: {
        async createWorkspace() {
            if(!this.workspace) {
                if(this.githubSession) {
                    this.$store.dispatch('createWorkspace', {
                        name: this.workspaceName,
                        _type: 'github',
                    })
                } else if(this.workspaceType === 'file') {
                    this.$store.dispatch('createWorkspace', {
                        name: this.workspaceName,
                        _type: this.workspaceType,
                        location: this.workspaceLocation
                    })
                } else {
                    this.$store.dispatch('createWorkspace', {
                        name: this.workspaceName
                    })
                }
            } else {
                if (this.workspaceType === 'file') {
                    this.$store.dispatch('updateWorkspace', {
                        _id: this.workspace._id,
                        updatedFields: {
                            name: this.workspaceName,
                            location: this.workspaceLocation
                        }
                    })
                } else {
                    this.$store.dispatch('updateWorkspace', {
                        _id: this.workspace._id,
                        updatedFields: {
                            name: this.workspaceName
                        }
                    })
                }
            }
            this.showModalComp = false
        },
        async getSetWorkspaceName() {
            try {
                const workspace = await fileIPC.getWorkspaceAtLocation(this.workspaceLocation, false)
                if(workspace) {
                    this.workspaceName = workspace.name
                }
            } catch {}
        },
    }
}
</script>
