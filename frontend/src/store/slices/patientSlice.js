import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

/**
 * Async Thunks for Patient module
 */
export const fetchPatientAppointments = createAsyncThunk(
  "patient/fetchAppointments",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/patients/appointments");
      return data.appointments || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch appointments");
    }
  }
);

export const bookAppointment = createAsyncThunk(
  "patient/bookAppointment",
  async (appointmentData, { rejectWithValue }) => {
    try {
      const { data } = await client.post("/patients/appointments", appointmentData);
      return data.appointment || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to book appointment");
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  "patient/cancelAppointment",
  async (appointmentId, { rejectWithValue }) => {
    try {
      const { data } = await client.patch(`/patients/appointments/${appointmentId}/cancel`);
      return { appointmentId, updated: data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to cancel appointment");
    }
  }
);

export const fetchPatientPrescriptions = createAsyncThunk(
  "patient/fetchPrescriptions",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/patients/prescriptions");
      return data.prescriptions || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch prescriptions");
    }
  }
);

export const fetchPatientBills = createAsyncThunk(
  "patient/fetchBills",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/patients/bills");
      return data.bills || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch bills");
    }
  }
);

export const updatePatientProfile = createAsyncThunk(
  "patient/updateProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      const { data } = await client.put("/patients/profile", profileData);
      return data.patient || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to update profile");
    }
  }
);

const patientSlice = createSlice({
  name: "patient",
  initialState: {
    appointments: [],
    prescriptions: [],
    bills: [],
    profile: null,
    loading: false,
    error: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  },
  reducers: {
    clearPatientError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Appointments
      .addCase(fetchPatientAppointments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatientAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchPatientAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Book Appointment
      .addCase(bookAppointment.fulfilled, (state, action) => {
        state.appointments.unshift(action.payload);
      })
      // Cancel Appointment
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex((a) => a._id === action.payload.appointmentId);
        if (index !== -1) {
          state.appointments[index].status = "cancelled";
        }
      })
      // Prescriptions
      .addCase(fetchPatientPrescriptions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPatientPrescriptions.fulfilled, (state, action) => {
        state.loading = false;
        state.prescriptions = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchPatientPrescriptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Bills
      .addCase(fetchPatientBills.fulfilled, (state, action) => {
        state.bills = Array.isArray(action.payload) ? action.payload : [];
      })
      // Profile
      .addCase(updatePatientProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
      });
  },
});

export const { clearPatientError } = patientSlice.actions;
export default patientSlice.reducer;
