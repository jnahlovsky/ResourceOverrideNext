import { ref, onMounted, onBeforeUnmount } from 'vue';

// Closing behaviour shared by the modals (Settings, Help, Test Rules): a click on the
// backdrop closes, but not one that started inside (e.g. selecting text in a field and
// letting go outside), and so does Esc unless a field inside handled it already.
// The code editor doesn't use it, so a stray click can't throw away unsaved edits.
export function useModal(isOpen, close) {
  const isBackdropPressed = ref(false);

  const onBackdropMousedown = (event) => {
    isBackdropPressed.value = event.target === event.currentTarget;
  };

  const onBackdropClick = (event) => {
    if (event.target === event.currentTarget && isBackdropPressed.value) close();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && isOpen.value && !event.defaultPrevented) close();
  };

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));

  return { onBackdropMousedown, onBackdropClick };
}
