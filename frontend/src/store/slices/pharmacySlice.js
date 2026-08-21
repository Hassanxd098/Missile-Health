import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

/**
 * Async Thunks for Pharmacy module
 */
export const fetchPharmacyInvoices = createAsyncThunk(
  "pharmacy/fetchInvoices",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/pharmacy/invoices");
      return data.invoices || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch invoices");
    }
  }
);

export const createInvoice = createAsyncThunk(
  "pharmacy/createInvoice",
  async (invoiceData, { rejectWithValue }) => {
    try {
      const { data } = await client.post("/pharmacy/invoices", invoiceData);
      return data.invoice || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to create invoice");
    }
  }
);

export const updateInvoiceStatus = createAsyncThunk(
  "pharmacy/updateInvoiceStatus",
  async ({ invoiceId, status }, { rejectWithValue }) => {
    try {
      const { data } = await client.patch(`/pharmacy/invoices/${invoiceId}`, { status });
      return { invoiceId, status, updated: data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to update invoice status");
    }
  }
);

export const fetchMedicines = createAsyncThunk(
  "pharmacy/fetchMedicines",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get("/pharmacy/medicines");
      return data.medicines || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch medicines");
    }
  }
);

const pharmacySlice = createSlice({
  name: "pharmacy",
  initialState: {
    invoices: [],
    medicines: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearPharmacyError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPharmacyInvoices.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPharmacyInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchPharmacyInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.invoices.unshift(action.payload);
      })
      .addCase(updateInvoiceStatus.fulfilled, (state, action) => {
        const index = state.invoices.findIndex((inv) => inv._id === action.payload.invoiceId);
        if (index !== -1) {
          state.invoices[index].status = action.payload.status;
        }
      })
      .addCase(fetchMedicines.fulfilled, (state, action) => {
        state.medicines = Array.isArray(action.payload) ? action.payload : [];
      });
  },
});

export const { clearPharmacyError } = pharmacySlice.actions;
export default pharmacySlice.reducer;
