<template>
  <F7Page name="create-update">
    <F7Navbar title="Create New Version" back-link="Back" transparent large>
      <F7NavRight>
        <F7Link @click="submit" class="font-bold">Create</F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7List
      strong-ios
      dividers-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4 mt-4"
    >
      <F7ListInput
        label="Version Name"
        type="text"
        placeholder="e.g. 1.0.5"
        :value="form.version_name"
        @input="form.version_name = $event.target.value"
        required
        validate
      />

      <F7ListItem title="Channel" smart-select :smart-select-params="{ openIn: 'popover' }">
        <select v-model="form.channel">
          <option value="prod">Production</option>
          <option value="staging">Staging</option>
          <option value="dev">Development</option>
        </select>
      </F7ListItem>

      <F7ListItem title="Platform" smart-select :smart-select-params="{ openIn: 'popover' }">
        <select v-model="form.platform">
          <option value="ios">iOS</option>
          <option value="android">Android</option>
          <option value="web">Web</option>
        </select>
      </F7ListItem>

      <F7ListInput
        label="Release Notes"
        type="textarea"
        resizable
        placeholder="What's new in this version?"
        :value="form.release_notes"
        @input="form.release_notes = $event.target.value"
      />

      <F7ListItem class="file-input-item">
        <div class="p-4 w-full">
          <div class="text-xs font-black uppercase tracking-widest opacity-40 mb-2">
            Build File (.zip, .apk, .ipa)
          </div>
          <input
            type="file"
            @change="onFileChange"
            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </F7ListItem>
    </F7List>

    <F7Block>
      <F7Button fill large round @click="submit" :disabled="isSubmitting">
        {{ isSubmitting ? "Uploading..." : "Create Version" }}
      </F7Button>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { f7 } from "framework7-vue";
import { createBundle } from "../queries/updates.queries";
import { useAppStore } from "@/shared/stores/app.store";

const props = defineProps<{
  f7router: any;
}>();

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const isSubmitting = ref(false);
const selectedFile = ref<File | null>(null);

const form = reactive({
  version_name: "",
  channel: "dev",
  platform: "web",
  release_notes: "",
});

const onFileChange = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile.value = file;
  }
};

const submit = async () => {
  if (!activeApp.value) return;
  if (!form.version_name) {
    f7.dialog.alert("Please enter a version name.");
    return;
  }
  if (!selectedFile.value) {
    f7.dialog.alert("Please select a file to upload.");
    return;
  }

  isSubmitting.value = true;
  f7.preloader.show();

  try {
    const formData = new FormData();
    formData.append("file", selectedFile.value);
    formData.append("app_id", activeApp.value.app_id);
    formData.append("version_name", form.version_name);
    formData.append("channel", form.channel);
    formData.append("platform", form.platform);
    formData.append("release_notes", form.release_notes);
    formData.append("active", "true");
    formData.append("required", "false");

    await createBundle(formData);

    f7.toast.create({ text: "Version created successfully!", closeTimeout: 2000 }).open();
    props.f7router.back();
  } catch (error: any) {
    f7.dialog.alert(error.message || "Failed to create version", "Error");
  } finally {
    isSubmitting.value = false;
    f7.preloader.hide();
  }
};
</script>

<style scoped>
.file-input-item :deep(.item-inner) {
  display: block;
}
</style>
