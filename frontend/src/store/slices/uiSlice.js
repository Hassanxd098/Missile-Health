import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    toasts: [],
    globalLoading: false,
    sidebarOpen: true,
  },
  reducers: {
    addToast: (state, action) => {
      // payload: { id, type: 'success' | 'error' | 'info', message }
      state.toasts.push({
        id: action.payload.id || Date.now().toString(),
        type: action.payload.type || "info",
        message: action.payload.message,
      });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { addToast, removeToast, setGlobalLoading, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
