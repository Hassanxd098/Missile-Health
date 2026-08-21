import http from "http";

function api(method, path, body, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: 4000,
      path: path,
      method: method,
      headers: { "Content-Type": "application/json" },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on("error", (e) => resolve({ status: 0, error: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 1. Super admin login
  const saLogin = await api("POST", "/api/super-admin/login", {
    email: "admin@example.com",
    password: "Admin@321",
  });
  console.log("1. Super Admin Login:", saLogin.status);
  const saToken = saLogin.body?.accessToken;

  // 2. Super admin creates Shifa Clinic
  const createHospital = await api("POST", "/api/super-admin/hospitals", {
    name: "Shifa Clinic",
    code: "2778",
    email: "shifa@clinic.com",
    phone: "555-1000",
    address: "123 Medical St",
    city: "Karachi",
    state: "Sindh",
    country: "PK",
    status: "active",
    adminName: "Shifa Admin",
    adminEmail: "admin@shifa.clinic",
    adminMobile: "555-1001",
    adminPassword: "ShifaAdmin@123",
  }, saToken);
  console.log("2. Create Shifa Clinic:", createHospital.status, createHospital.body?.hospital?.code || createHospital.body);
  const hospitalId = createHospital.body?.hospital?._id;

  // 3. Shifa Clinic admin login
  const clinicAdminLogin = await api("POST", "/api/auth/login", {
    email: "admin@shifa.clinic",
    password: "ShifaAdmin@123",
    role: "hospital_admin",
  });
  console.log("3. Shifa Admin Login:", clinicAdminLogin.status);
  const clinicAdminToken = clinicAdminLogin.body?.accessToken;

  // 4. Create 3 doctors in Shifa Clinic
  for (const doc of [
    { name: "Dr. Affan", email: "affan@shifa.com", password: "Doctor@1234", profile: { specialty: "Cardiologist", visitingHours: "10:00-16:00", consultationFee: 500 } },
    { name: "Dr. Faizan", email: "faizan@shifa.com", password: "Doctor@1234", profile: { specialty: "Neurologist", visitingHours: "11:00-17:00", consultationFee: 600 } },
    { name: "Dr. Maaz", email: "maaz@shifa.com", password: "Doctor@1234", profile: { specialty: "Pediatrician", visitingHours: "09:00-15:00", consultationFee: 400 } },
  ]) {
    const createDoc = await api("POST", "/api/admin/doctors", doc, clinicAdminToken);
    console.log("  - Create", doc.name, ":", createDoc.status);
  }

  // 5. Verify public endpoint shows hospitals
  const publicHospitals = await api("GET", "/api/public/hospitals");
  console.log("4. Public hospital list:", publicHospitals.status, "Hospitals:", publicHospitals.body?.hospitals?.map((h) => h.code));

  // 6. Verify public endpoint shows doctors for Shifa Clinic
  const publicDoctors = await api("GET", "/api/public/hospitals/2778/doctors");
  console.log("5. Public doctors list for 2778:", publicDoctors.status);
  console.log("  Hospital:", publicDoctors.body?.hospital?.name);
  console.log("  Doctors:", publicDoctors.body?.doctors?.map((d) => d.name));

  // 7. Register patient with hospitalCode=2778
  const registerPatient = await api("POST", "/api/auth/register?hospitalCode=2778", {
    name: "Test Patient",
    mobile: "9999999999",
    email: "patient@test.com",
    password: "Patient@1234",
  });
  console.log("6. Register patient (hospitalCode=2778):", registerPatient.status);

  // 8. Login as patient and verify they see Shifa Clinic doctors
  const patientLogin = await api("POST", "/api/auth/login", {
    email: "patient@test.com",
    password: "Patient@1234",
    role: "patient",
  });
  console.log("7. Patient Login:", patientLogin.status);
  const patientToken = patientLogin.body?.accessToken;

  const patientHome = await api("GET", "/api/patients/home", null, patientToken);
  console.log("8. Patient Home (doctors visible):", patientHome.status);
  console.log("  Doctors seen by patient:", patientHome.body?.doctors?.map((d) => d.name));

  // Verify tenant isolation
  const patientHospitalId = patientLogin.body?.user?.hospitalId;
  console.log("  Patient hospitalId:", patientHospitalId);

  console.log("\n=== Flow Complete ===");
  console.log("If 3 doctors appear in step 8, everything works!");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
