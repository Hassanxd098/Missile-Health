import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client, { authStore } from "../../api/client";

// Get initial state safely from localStorage
const getInitialUser = () => {
  try {
    const raw = localStorage.getItem("missile_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Async Thunk: Login user
 */
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ identifier, password, role, remember }, { rejectWithValue }) => {
    try {
      const payload = { identifier, password, role, remember };
      const { data } = await client.post("/auth/login", payload);
      authStore.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      localStorage.setItem("missile_remember", remember ? "1" : "0");
      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || "Unable to sign in. Please try again.";
      return rejectWithValue(message);
    }
  }
);

/**
 * Async Thunk: Logout user
 */
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    authStore.clear();
    localStorage.removeItem("missile_remember");
    return null;
  }
);

/**
 * Async Thunk: Refresh user profile / session
 */
export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/auth/me");
      if (data.user) {
        authStore.set({ user: data.user });
      }
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch user session");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: getInitialUser(),
    token: authStore.getAccess(),
    isAuthenticated: !!getInitialUser(),
    loading: false,
    error: null,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
      })
      // Fetch Current User
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
      });
  },
});

export const { setUser, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
