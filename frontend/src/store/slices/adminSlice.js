import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

/**
 * Async Thunks for Admin / Hospital Admin module
 */
export const fetchAdminDashboard = createAsyncThunk(
  "admin/fetchDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/admin/dashboard");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch admin stats");
    }
  }
);

export const fetchDoctors = createAsyncThunk(
  "admin/fetchDoctors",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/admin/doctors");
      return data.doctors || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch doctors");
    }
  }
);

export const createDoctor = createAsyncThunk(
  "admin/createDoctor",
  async (doctorData, { rejectWithValue }) => {
    try {
      const { data } = await client.post("/admin/doctors", doctorData);
      return data.doctor || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to create doctor");
    }
  }
);

export const updateDoctor = createAsyncThunk(
  "admin/updateDoctor",
  async ({ doctorId, doctorData }, { rejectWithValue }) => {
    try {
      const { data } = await client.put(`/admin/doctors/${doctorId}`, doctorData);
      return data.doctor || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to update doctor");
    }
  }
);

export const deleteDoctor = createAsyncThunk(
  "admin/deleteDoctor",
  async (doctorId, { rejectWithValue }) => {
    try {
      await client.delete(`/admin/doctors/${doctorId}`);
      return doctorId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to delete doctor");
    }
  }
);

export const fetchEmployees = createAsyncThunk(
  "admin/fetchEmployees",
  async (roleFilter, { rejectWithValue }) => {
    try {
      const url = roleFilter ? `/admin/employees?role=${roleFilter}` : "/admin/employees";
      const { data } = await client.get(url);
      return data.employees || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch employees");
    }
  }
);

export const createEmployee = createAsyncThunk(
  "admin/createEmployee",
  async (employeeData, { rejectWithValue }) => {
    try {
      const { data } = await client.post("/admin/employees", employeeData);
      return data.employee || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to create employee");
    }
  }
);

export const fetchAdminPatients = createAsyncThunk(
  "admin/fetchPatients",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/admin/patients");
      return data.patients || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch patients");
    }
  }
);

export const fetchReports = createAsyncThunk(
  "admin/fetchReports",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/admin/reports", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch reports");
    }
  }
);

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    stats: null,
    doctors: [],
    employees: [],
    patients: [],
    reports: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard stats
      .addCase(fetchAdminDashboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdminDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchAdminDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Doctors
      .addCase(fetchDoctors.fulfilled, (state, action) => {
        state.doctors = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(createDoctor.fulfilled, (state, action) => {
        state.doctors.push(action.payload);
      })
      .addCase(updateDoctor.fulfilled, (state, action) => {
        const index = state.doctors.findIndex((d) => d._id === action.payload._id);
        if (index !== -1) state.doctors[index] = action.payload;
      })
      .addCase(deleteDoctor.fulfilled, (state, action) => {
        state.doctors = state.doctors.filter((d) => d._id !== action.payload);
      })
      // Employees
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.employees = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(createEmployee.fulfilled, (state, action) => {
        state.employees.push(action.payload);
      })
      // Patients
      .addCase(fetchAdminPatients.fulfilled, (state, action) => {
        state.patients = Array.isArray(action.payload) ? action.payload : [];
      })
      // Reports
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports = action.payload;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;
