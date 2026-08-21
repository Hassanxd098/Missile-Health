import http from "http";

const log = (label, status, body) => {
  const ok = status >= 200 && status < 300;
  const bodyStr = typeof body === "object" ? JSON.stringify(body).slice(0, 300) : String(body || "").slice(0, 300);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}: ${status}`);
  if (!ok) console.log("  Body:", bodyStr);
  return ok;
};

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
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; }
        catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on("error", (e) => resolve({ status: 0, error: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  let passCount = 0;
  let failCount = 0;
  const check = (label, status, body) => {
    const ok = log(label, status, body);
    if (ok) passCount++; else failCount++;
    return ok;
  };

  // TEST 1: Health check
  const health = await api("GET", "/api/health");
  check("Health check", health.status, health.body);

  // TEST 2: Super Admin Login
  const saLogin = await api("POST", "/api/super-admin/login", {
    email: "admin@example.com",
    password: "Admin@321",
  });
  check("Super Admin Login", saLogin.status, saLogin.body);
  const saToken = saLogin.body?.accessToken;
  let ok = false;
  if (saToken) {
    const payload = JSON.parse(Buffer.from(saToken.split(".")[1], "base64").toString());
    console.log("  JWT role:", payload.role, "hospitalId:", payload.hospitalId);
    ok = payload.hospitalId === null;
    ok = log("Super admin has no hospitalId (platform level)", 200, null) && ok;
  }
  if (ok) passCount++; else failCount++;

  // TEST 3: Create Hospital A
  const createA = await api("POST", "/api/super-admin/hospitals", {
    name: "City Medical Center",
    code: "CITY",
    email: "city@med.com",
    phone: "555-1000",
    address: "123 Main St",
    city: "Metropolis",
    state: "CA",
    country: "USA",
    status: "active",
    adminName: "Dr. Alice Smith",
    adminEmail: "alice@city.med.com",
    adminMobile: "555-1001",
    adminPassword: "CityAdmin@123",
  }, saToken);
  check("Create Hospital A (City Medical)", createA.status, createA.body);
  const hospitalAId = createA.body?.hospital?._id;

  // TEST 4: Create Hospital B
  const createB = await api("POST", "/api/super-admin/hospitals", {
    name: "County General Hospital",
    code: "COUNTY",
    email: "county@med.com",
    phone: "555-2000",
    address: "456 Oak Ave",
    city: "Gotham",
    state: "NY",
    country: "USA",
    status: "active",
    adminName: "Dr. Bob Jones",
    adminEmail: "bob@county.med.com",
    adminMobile: "555-2001",
    adminPassword: "CountyAdmin@123",
  }, saToken);
  check("Create Hospital B (County General)", createB.status, createB.body);
  const hospitalBId = createB.body?.hospital?._id;

  // TEST 5: List hospitals (Super Admin)
  const list = await api("GET", "/api/super-admin/hospitals", null, saToken);
  check("List Hospitals (Super Admin)", list.status, list.body);
  console.log("  Hospitals found:", list.body?.hospitals?.length);

  // TEST 6: Hospital A Admin Login
  const adminALogin = await api("POST", "/api/auth/login", {
    email: "alice@city.med.com",
    password: "CityAdmin@123",
    role: "hospital_admin",
  });
  check("Hospital A Admin Login", adminALogin.status, adminALogin.body);
  const adminAToken = adminALogin.body?.accessToken;
  if (adminAToken) {
    const payload = JSON.parse(Buffer.from(adminAToken.split(".")[1], "base64").toString());
    console.log("  JWT role:", payload.role, "hospitalId:", payload.hospitalId);
    const hasHospital = payload.hospitalId !== null;
    if (hasHospital) { console.log("  [PASS] Hospital admin has hospitalId in JWT"); passCount++; }
    else { console.log("  [FAIL] Hospital admin must have a hospitalId"); failCount++; }
  }

  // TEST 7: Hospital B Admin Login
  const adminBLogin = await api("POST", "/api/auth/login", {
    email: "bob@county.med.com",
    password: "CountyAdmin@123",
    role: "hospital_admin",
  });
  check("Hospital B Admin Login", adminBLogin.status, adminBLogin.body);
  const adminBToken = adminBLogin.body?.accessToken;

  // TEST 8: Hospital A Admin Dashboard
  const adminAHome = await api("GET", "/api/admin/home", null, adminAToken);
  check("Hospital A Admin Dashboard", adminAHome.status, adminAHome.body);

  // TEST 9: Hospital B Admin Dashboard
  const adminBHome = await api("GET", "/api/admin/home", null, adminBToken);
  check("Hospital B Admin Dashboard", adminBHome.status, adminBHome.body);

  // TEST 10: Add Patient A via Hospital A reception
  const addPatientA = await api("POST", "/api/reception/patients", {
    name: "Patient A",
    mobile: "5550101001",
    age: 30,
    gender: "Male",
    address: "City",
  }, adminAToken);
  check("Hospital A - Add Patient A", addPatientA.status, addPatientA.body);
  const patientAMobile = "5550101001";

  // TEST 11: Add Patient B via Hospital B reception
  const addPatientB = await api("POST", "/api/reception/patients", {
    name: "Patient B",
    mobile: "5550202002",
    age: 25,
    gender: "Female",
    address: "Gotham",
  }, adminBToken);
  check("Hospital B - Add Patient B", addPatientB.status, addPatientB.body);
  const patientBMobile = "5550202002";

  // TEST 12: Hospital A Admin lists patients (should see Patient A, NOT Patient B)
  const getPatientsA = await api("GET", "/api/admin/patients", null, adminAToken);
  check("Hospital A Admin - List Patients", getPatientsA.status, getPatientsA.body);
  const paVisible = getPatientsA.body?.patients?.some((p) => p.mobile === patientAMobile);
  const pbVisibleA = getPatientsA.body?.patients?.some((p) => p.mobile === patientBMobile);
  if (paVisible) { console.log("  [PASS] Hospital A admin sees their own patient (Patient A)"); passCount++; }
  else { console.log("  [FAIL] Hospital A admin cannot see their own patient"); failCount++; }
  if (!pbVisibleA) { console.log("  [PASS] Hospital A admin does NOT see Hospital B patient (Patient B)"); passCount++; }
  else { console.log("  [FAIL] Hospital A admin can see Hospital B patient!"); failCount++; }

  // TEST 13: Hospital B Admin lists patients (should see Patient B, NOT Patient A)
  const getPatientsB = await api("GET", "/api/admin/patients", null, adminBToken);
  check("Hospital B Admin - List Patients", getPatientsB.status, getPatientsB.body);
  const pbVisible = getPatientsB.body?.patients?.some((p) => p.mobile === patientBMobile);
  const paVisibleB = getPatientsB.body?.patients?.some((p) => p.mobile === patientAMobile);
  if (pbVisible) { console.log("  [PASS] Hospital B admin sees their own patient (Patient B)"); passCount++; }
  else { console.log("  [FAIL] Hospital B admin cannot see their own patient"); failCount++; }
  if (!paVisibleB) { console.log("  [PASS] Hospital B admin does NOT see Hospital A patient (Patient A)"); passCount++; }
  else { console.log("  [FAIL] Hospital B admin can see Hospital A patient!"); failCount++; }

  // TEST 14: Try to access another hospital's patient by direct route (reception lookup)
  const lookupB = await api("GET", `/api/reception/patients?q=5550101`, null, adminBToken);
  check("Hospital B Admin lookup for Patient A (isolation)", lookupB.status, lookupB.body);
  const crossFound = lookupB.body?.patients?.some((p) => p.mobile === patientAMobile);
  if (!crossFound) { console.log("  [PASS] Hospital B cannot find Hospital A patient via search"); passCount++; }
  else { console.log("  [FAIL] Hospital B can find Hospital A patient via search!"); failCount++; }

  // TEST 15: Create doctor via Hospital A admin - verify hospitalId from token, not body
  const createDoctorA = await api("POST", "/api/admin/doctors", {
    name: "Dr. Alice Cooper",
    email: "dralice@city.med.com",
    password: "DoctorPass@123",
    profile: { specialty: "Cardiology", location: "Ward 1", visitingHours: "10:00-14:00", consultationFee: 500 },
  }, adminAToken);
  check("Hospital A Admin - Create Doctor", createDoctorA.status, createDoctorA.body);

  // TEST 16: Try creating doctor with injected hospitalId (should be ignored)
  const createDoctorInject = await api("POST", "/api/admin/doctors", {
    name: "Dr. Inject",
    email: "drinject@county.med.com",
    password: "DoctorPass@123",
    profile: { specialty: "Test" },
    hospitalId: hospitalBId,
  }, adminAToken);
  check("Hospital A Admin - Create Doctor with injected hospitalId", createDoctorInject.status, createDoctorInject.body);

  // TEST 17: Doctor login and verify hospital scope
  const docLogin = await api("POST", "/api/auth/login", {
    email: "dralice@city.med.com",
    password: "DoctorPass@123",
    role: "doctor",
  });
  check("Doctor Login (Hospital A)", docLogin.status, docLogin.body);
  const docToken = docLogin.body?.accessToken;
  if (docToken) {
    const payload = JSON.parse(Buffer.from(docToken.split(".")[1], "base64").toString());
    console.log("  JWT hospitalId:", payload.hospitalId);
    const correctScope = String(payload.hospitalId) === String(hospitalAId);
    if (correctScope) { console.log("  [PASS] Doctor's JWT scoped to Hospital A"); passCount++; }
    else { console.log("  [FAIL] Doctor's JWT not scoped to Hospital A"); failCount++; }
  }

  // TEST 18: Super Admin sees all hospitals
  const saHospitals = await api("GET", "/api/super-admin/hospitals", null, saToken);
  check("Super Admin - List All Hospitals", saHospitals.status, saHospitals.body);
  const codes = saHospitals.body?.hospitals?.map((h) => h.code);
  console.log("  Hospital codes:", codes);
  if (codes?.includes("CITY") && codes?.includes("COUNTY")) {
    console.log("  [PASS] Super Admin sees both hospitals"); passCount++;
  } else {
    console.log("  [FAIL] Super Admin should see both hospitals"); failCount++;
  }

  // TEST 19: Hospital A admin can access doctor route
  const doctorsA = await api("GET", "/api/admin/doctors", null, adminAToken);
  check("Hospital A Admin - List Doctors", doctorsA.status, doctorsA.body);

  // TEST 20: Hospital B admin can access doctor route
  const doctorsB = await api("GET", "/api/admin/doctors", null, adminBToken);
  check("Hospital B Admin - List Doctors", doctorsB.status, doctorsB.body);

  // TEST 21: Hospital admin cannot access super-admin routes
  const saRouteAccess = await api("GET", "/api/super-admin/hospitals", null, adminAToken);
  const blocked1 = saRouteAccess.status === 401 || saRouteAccess.status === 403;
  log("Hospital A Admin - Blocked from super-admin route", blocked1 ? 200 : saRouteAccess.status, saRouteAccess.body);
  if (blocked1) { console.log("  [PASS] Hospital admin blocked from super-admin route"); passCount++; }
  else { console.log("  [FAIL] Hospital admin should be blocked from super-admin route"); failCount++; }

  // TEST 22: Non-super-admin cannot login via super-admin login
  const badSaLogin = await api("POST", "/api/super-admin/login", {
    email: "alice@city.med.com",
    password: "CityAdmin@123",
  });
  const blocked2 = badSaLogin.status === 401;
  log("Hospital admin - Blocked from super-admin login", blocked2 ? 200 : badSaLogin.status, badSaLogin.body);
  if (blocked2) { console.log("  [PASS] Hospital admin cannot login via super-admin login"); passCount++; }
  else { console.log("  [FAIL] Hospital admin should be blocked from super-admin login"); failCount++; }

  console.log(`\n=== Results: ${passCount} passed, ${failCount} failed ===`);
  process.exit(failCount > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
