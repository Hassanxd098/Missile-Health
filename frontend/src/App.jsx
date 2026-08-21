import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PatientProvider, usePatient } from "./context/PatientContext";
import { ToastProvider } from "./components/ui";
import AppShell from "./components/AppShell";

import Login from "./pages/Login";
import Register from "./pages/Register";
import SuperAdminLogin from "./pages/superAdmin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/superAdmin/SuperAdminDashboard";

import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientProfile from "./pages/patient/PatientProfile";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientPrescriptions from "./pages/patient/PatientPrescriptions";
import PatientBills from "./pages/patient/PatientBills";

import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import Consultation from "./pages/doctor/Consultation";
import DoctorPrescriptions from "./pages/doctor/DoctorPrescriptions";

import PharmacyDashboard from "./pages/pharmacy/PharmacyDashboard";
import PharmacyInvoices from "./pages/pharmacy/PharmacyInvoices";

import ReceptionDashboard from "./pages/reception/ReceptionDashboard";

import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageDoctors from "./pages/admin/ManageDoctors";
import ManagePharmacy from "./pages/admin/ManagePharmacy";
import ManageEmployees from "./pages/admin/ManageEmployees";
import ManageAttendance from "./pages/admin/ManageAttendance";
import ManageAdmins from "./pages/admin/ManageAdmins";
import ManagePatients from "./pages/admin/ManagePatients";
import AdminAppointments from "./pages/admin/AdminAppointments";
import Reports from "./pages/admin/Reports";

const HOSPITAL_ADMIN_ROUTES = [
  ["/app/hospital/dashboard", AdminDashboard],
  ["/app/hospital/doctors", ManageDoctors],
  ["/app/hospital/pharmacy", ManagePharmacy],
  ["/app/hospital/employees", ManageEmployees],
  ["/app/hospital/employees/:type", ManageEmployees],
  ["/app/hospital/attendance", ManageAttendance],
  ["/app/hospital/patients", ManagePatients],
  ["/app/hospital/appointments", AdminAppointments],
  ["/app/hospital/reports", Reports],
];

const ADMIN_ROUTES = [
  ["/app/admin", AdminDashboard],
  ["/app/admin/doctors", ManageDoctors],
  ["/app/admin/pharmacy", ManagePharmacy],
  ["/app/admin/employees", ManageEmployees],
  ["/app/admin/employees/:type", ManageEmployees],
  ["/app/admin/attendance", ManageAttendance],
  ["/app/admin/patients", ManagePatients],
  ["/app/admin/appointments", AdminAppointments],
];

const APP_ROUTES = {
  patient: [
    ["/app/patient", PatientDashboard],
    ["/app/patient/profile", PatientProfile],
    ["/app/patient/appointments", PatientAppointments],
    ["/app/patient/prescriptions", PatientPrescriptions],
    ["/app/patient/bills", PatientBills],
  ],
  doctor: [
    ["/app/doctor", DoctorDashboard],
    ["/app/doctor/consult/:appointmentId", Consultation],
    ["/app/doctor/prescriptions", DoctorPrescriptions],
  ],
  pharmacy: [
    ["/app/pharmacy", PharmacyDashboard],
    ["/app/pharmacy/invoices", PharmacyInvoices],
  ],
  reception: [
    ["/app/reception", ReceptionDashboard],
  ],
  admin: ADMIN_ROUTES,
  hospital_admin: HOSPITAL_ADMIN_ROUTES,
  superadmin: ADMIN_ROUTES,
};

// Route guard: verifies the user's role matches the required role.
// hospital_admin maps to /app/hospital/* routes.
function RequireShell({ role, children }) {
  const { patient } = usePatient();
  if (!patient) return <Navigate to="/login" replace />;

  // Super admin navigates to /super-admin routes
  if (patient.role === "superadmin") {
    if (role !== "superadmin") return <Navigate to="/super-admin/dashboard" replace />;
    return children;
  }

  // Hospital admin routes
  if (role === "hospital_admin") {
    if (patient.role !== "hospital_admin") return <Navigate to={`/app/${patient.role}`} replace />;
    return <AppShell>{children}</AppShell>;
  }

  // Standard role routes
  const roleMap = { admin: "admin", hospital_admin: "hospital_admin" };
  const normalizedRole = roleMap[patient.role] || patient.role;
  if (!role.includes(patient.role)) return <Navigate to={`/app/${normalizedRole === "admin" ? "admin" : normalizedRole}`} replace />;
  return <AppShell>{children}</AppShell>;
}

function HomeRedirect() {
  const { patient } = usePatient();
  if (!patient) return <Navigate to="/login" replace />;
  if (patient.role === "superadmin") return <Navigate to="/super-admin/dashboard" replace />;
  if (patient.role === "hospital_admin") return <Navigate to="/app/hospital/dashboard" replace />;
  if (!APP_ROUTES[patient.role]) return <Navigate to="/login" replace />;
  return <Navigate to={`/app/${patient.role}`} replace />;
}

export default function App() {
  return (
    <PatientProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/super-admin/login" element={<SuperAdminLogin />} />
            <Route path="/" element={<HomeRedirect />} />
            {/* Super Admin routes */}
            <Route path="/super-admin/dashboard" element={
              <RequireShell role="superadmin"><SuperAdminDashboard /></RequireShell>
            } />
            {/* Hospital / standard app routes */}
            {Object.entries(APP_ROUTES).flatMap(([role, list]) =>
              list.map(([path, Component]) => (
                <Route key={path} path={path} element={
                  <RequireShell role={role}><Component /></RequireShell>
                } />
              )),
            )}
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </PatientProvider>
  );
}
