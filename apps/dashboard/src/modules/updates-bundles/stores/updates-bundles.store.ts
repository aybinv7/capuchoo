import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UpdateOrBundle, Bundle, NativeUpdate } from '../types/updates-bundles.types';

export const useUpdatesBundlesStore = defineStore('updatesBundles', () => {
  // State
  const updatesBundles = ref<UpdateOrBundle[]>([]);
  const bundles = ref<Bundle[]>([]);
  const nativeUpdates = ref<NativeUpdate[]>([]);
  const selectedItems = ref<UpdateOrBundle[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const getAllUpdatesBundles = computed(() => updatesBundles.value);
  const getAllBundles = computed(() => bundles.value);
  const getAllNativeUpdates = computed(() => nativeUpdates.value);
  const getSelectedItems = computed(() => selectedItems.value);
  const isLoading = computed(() => loading.value);
  const getError = computed(() => error.value);

  // Actions
  const setItems = (items: UpdateOrBundle[]) => {
    updatesBundles.value = items;
    
    // Separate bundles and native updates
    bundles.value = items
      .filter(item => item.type === 'bundle') 
      .map(item => item as Bundle);
      
    nativeUpdates.value = items
      .filter(item => item.type === 'native')
      .map(item => item as NativeUpdate);
  };

  const setSelectedItems = (items: UpdateOrBundle[]) => {
    selectedItems.value = items;
  };

  const addItem = (item: UpdateOrBundle) => {
    updatesBundles.value.push(item);
    
    if (item.type === 'bundle') {
      bundles.value.push(item as Bundle);
    } else {
      nativeUpdates.value.push(item as NativeUpdate);
    }
  };

  const updateItem = (updatedItem: UpdateOrBundle) => {
    const index = updatesBundles.value.findIndex(i => i.id === updatedItem.id);
    if (index !== -1) {
      updatesBundles.value[index] = updatedItem;
      
      if (updatedItem.type === 'bundle') {
        const bundleIndex = bundles.value.findIndex(b => b.id === updatedItem.id);
        if (bundleIndex !== -1) {
          bundles.value[bundleIndex] = updatedItem as Bundle;
        }
      } else {
        const nativeIndex = nativeUpdates.value.findIndex(n => n.id === updatedItem.id);
        if (nativeIndex !== -1) {
          nativeUpdates.value[nativeIndex] = updatedItem as NativeUpdate;
        }
      }
    }
  };

  const removeItem = (id: string | number) => {
    updatesBundles.value = updatesBundles.value.filter(item => item.id !== id);
    bundles.value = bundles.value.filter(bundle => bundle.id !== id);
    nativeUpdates.value = nativeUpdates.value.filter(native => native.id !== id);
    
    // Also remove from selection if present
    selectedItems.value = selectedItems.value.filter(item => item.id !== id);
  };

  const setLoading = (status: boolean) => {
    loading.value = status;
  };

  const setError = (message: string | null) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  const clearSelection = () => {
    selectedItems.value = [];
  };

  return {
    // State
    updatesBundles,
    bundles,
    nativeUpdates,
    selectedItems,
    loading,
    error,

    // Getters
    getAllUpdatesBundles,
    getAllBundles,
    getAllNativeUpdates,
    getSelectedItems,
    isLoading,
    getError,

    // Actions
    setItems,
    setSelectedItems,
    addItem,
    updateItem,
    removeItem,
    setLoading,
    setError,
    clearError,
    clearSelection,
  };
});