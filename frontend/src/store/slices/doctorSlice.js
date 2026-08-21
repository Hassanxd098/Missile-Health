import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

/**
 * Async Thunks for Doctor module
 */
export const fetchDoctorAppointments = createAsyncThunk(
  "doctor/fetchAppointments",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/doctor/appointments");
      return data.appointments || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch doctor appointments");
    }
  }
);

export const updateAppointmentStatus = createAsyncThunk(
  "doctor/updateAppointmentStatus",
  async ({ appointmentId, status, notes }, { rejectWithValue }) => {
    try {
      const { data } = await client.patch(`/doctor/appointments/${appointmentId}/status`, { status, notes });
      return { appointmentId, status, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to update appointment status");
    }
  }
);

export const createDoctorPrescription = createAsyncThunk(
  "doctor/createPrescription",
  async (prescriptionData, { rejectWithValue }) => {
    try {
      const { data } = await client.post("/doctor/prescriptions", prescriptionData);
      return data.prescription || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to issue prescription");
    }
  }
);

export const fetchConsultationDetails = createAsyncThunk(
  "doctor/fetchConsultationDetails",
  async (appointmentId, { rejectWithValue }) => {
    try {
      const { data } = await client.get(`/consultations/${appointmentId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch consultation details");
    }
  }
);

const doctorSlice = createSlice({
  name: "doctor",
  initialState: {
    appointments: [],
    currentConsultation: null,
    prescriptions: [],
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentConsultation: (state, action) => {
      state.currentConsultation = action.payload;
    },
    clearDoctorError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Doctor Appointments
      .addCase(fetchDoctorAppointments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDoctorAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchDoctorAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update Appointment Status
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        const index = state.appointments.findIndex((a) => a._id === action.payload.appointmentId);
        if (index !== -1) {
          state.appointments[index].status = action.payload.status;
        }
      })
      // Create Prescription
      .addCase(createDoctorPrescription.fulfilled, (state, action) => {
        state.prescriptions.unshift(action.payload);
      })
      // Fetch Consultation
      .addCase(fetchConsultationDetails.fulfilled, (state, action) => {
        state.currentConsultation = action.payload;
      });
  },
});

export const { setCurrentConsultation, clearDoctorError } = doctorSlice.actions;
export default doctorSlice.reducer;
