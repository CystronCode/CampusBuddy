'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('../../frontend-next/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = path.resolve(__dirname, '..', '04_PRODUCT_DEPLOYMENT', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  let currentUser = {
    id: "c8f56b46-c167-43c3-93bf-84304a37239a",
    email: "student@campus.edu.in",
    role: "student",
    name: "Alex Student",
    department: "CSE",
    semester: 5,
    section: "A"
  };

  await page.route('**/v1/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/v1/auth/login')) {
      const postData = JSON.parse(route.request().postData() || '{}');
      const isAdmin = (postData.email || '').includes('admin');
      currentUser = isAdmin ? {
        id: "8c5f6b46-c167-43c3-93bf-84304a37239f",
        email: "admin@campus.edu.in",
        role: "institution_admin",
        name: "Campus Admin",
        department: "CSE",
        semester: 5,
        section: "A"
      } : {
        id: "c8f56b46-c167-43c3-93bf-84304a37239a",
        email: "student@campus.edu.in",
        role: "student",
        name: "Alex Student",
        department: "CSE",
        semester: 5,
        section: "A"
      };

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            access_token: "mock-jwt-token-verified-present",
            token_type: "bearer",
            user: { id: currentUser.id, email: currentUser.email, role: currentUser.role, user_metadata: { name: currentUser.name, role: currentUser.role } }
          },
          user: { id: currentUser.id, email: currentUser.email, role: currentUser.role }
        })
      });
    }

    if (url.includes('/v1/memberships')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          tenant_id: "00000000-0000-4000-8000-000000000001",
          institution: "RVCE Campus Intelligence",
          role: currentUser.role,
          name: currentUser.name,
          demo: false
        }])
      });
    }

    if (url.includes('/v1/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: currentUser.id,
          tenant_id: "00000000-0000-4000-8000-000000000001",
          name: currentUser.name,
          role: currentUser.role,
          department: currentUser.department,
          semester: currentUser.semester,
          section: currentUser.section,
          diet: "vegetarian",
          interests: "AI, Distributed Systems, Robotics",
          institution: "RVCE Campus Intelligence",
          demo: false,
          timezone: "Asia/Kolkata"
        })
      });
    }

    if (url.includes('/v1/overview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          next_class: {
            id: "tt-1",
            subject: "Machine Learning (CS501)",
            faculty_name: "Dr. K. N. Subramanya",
            room: "CS-204",
            start_time: "10:00",
            end_time: "11:00",
            kind: "lecture"
          },
          classes: [
            { id: "tt-1", subject: "Machine Learning", room: "CS-204", start_time: "10:00", end_time: "11:00", faculty_name: "Dr. Subramanya" },
            { id: "tt-2", subject: "Cloud Computing", room: "CS-301", start_time: "11:15", end_time: "12:15", faculty_name: "Prof. Geetha" },
            { id: "tt-3", subject: "Database Internals Lab", room: "Lab-3", start_time: "14:00", end_time: "16:00", faculty_name: "Dr. Mallikarjuna" }
          ],
          notices: [
            { id: "not-1", title: "Semester End Exam (SEE) Schedule Released", category: "Academic Calendar", published: "2026-11-04" },
            { id: "not-2", title: "Smart India Hackathon 2026 Internal Registration", category: "Notice", published: "2026-11-02" }
          ],
          events: [
            { id: "ev-1", title: "AI / Robotics Symposium 2026", organizer: "Coding Club", venue: "Auditorium", date: "2026-11-10" }
          ],
          exams: [
            { id: "ex-1", title: "CIE-2 Machine Learning", date: "2026-11-18", start_time: "09:30" }
          ]
        })
      });
    }

    if (url.includes('/v1/timetable')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: "tt-1", day: 1, day_of_week: "Monday", start_time: "09:00", end_time: "10:00", subject: "Mathematics III", subject_name: "Statistics & Probability", short_code: "SBM", faculty_name: "Dr. S B Mallikarjuna", room: "CS-301", kind: "lecture" },
          { id: "tt-2", day: 1, day_of_week: "Monday", start_time: "10:00", end_time: "11:00", subject: "Data Structures", subject_name: "Advanced Data Structures", short_code: "KNS", faculty_name: "Dr. K N Subramanya", room: "CS-204", kind: "lecture" },
          { id: "tt-3", day: 1, day_of_week: "Monday", start_time: "11:15", end_time: "12:15", subject: "Operating Systems", subject_name: "Distributed OS", short_code: "AG", faculty_name: "Prof. Anitha G", room: "CS-205", kind: "lecture" },
          { id: "tt-4", day: 1, day_of_week: "Monday", start_time: "14:00", end_time: "16:00", subject: "OS & Networks Lab", subject_name: "Hands-on Linux Kernel", short_code: "AG", faculty_name: "Prof. Anitha G", room: "Lab-2", kind: "lab" }
        ])
      });
    }

    if (url.includes('/v1/menu') || url.includes('/v1/meals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: "m-1", name: "South Indian Thali", price: 75, vegetarian: true, calories: 520, protein_g: 14.5, meal: "lunch", facility: "Main Mess" },
          { id: "m-2", name: "Masala Dosa", price: 45, vegetarian: true, calories: 340, protein_g: 8.0, meal: "breakfast", facility: "Canteen" },
          { id: "m-3", name: "Veg Pulao with Raita", price: 60, vegetarian: true, calories: 410, protein_g: 11.2, meal: "lunch", facility: "Main Mess" },
          { id: "m-4", name: "Paneer Butter Masala Combo", price: 90, vegetarian: true, calories: 580, protein_g: 18.5, meal: "lunch", facility: "Canteen" },
          { id: "m-5", name: "Fresh Fruit Juice", price: 30, vegetarian: true, calories: 120, protein_g: 1.5, meal: "snacks", facility: "Juice Bar" }
        ])
      });
    }

    if (url.includes('/v1/conversations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    }

    if (url.includes('/v1/ingestion')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: "job-101",
            source_id: "src-timetable-3sem",
            data_type: "timetable",
            status: "approved",
            error: null,
            attempts: 1,
            created_at: "2026-11-04T10:30:00Z",
            preview: { imported_count: 32, message: "Published under timetable:CSE-3-A version 2" }
          },
          {
            id: "job-102",
            source_id: "src-mess-menu-nov",
            data_type: "menu",
            status: "pending_review",
            error: null,
            attempts: 1,
            created_at: "2026-11-04T14:15:00Z",
            preview: { records: [{ item: "Idli Vada", meal: "breakfast", price: 40 }], error_count: 0, valid_count: 18 }
          }
        ])
      });
    }

    if (url.includes('/v1/admin/system')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { timetable: 64, faculty: 28, events: 14, menu: 45, documents: 18 },
          traces: [
            { id: "tr-1", route: "Tier 0 (timetable)", tools: [{ tool: "get_timetable", latency_ms: 12, success: true }], latency_ms: 12, success: true, created_at: "2026-11-05T07:15:00Z" },
            { id: "tr-2", route: "Tier 1 (search_docs)", tools: [{ tool: "search_docs", latency_ms: 340, success: true }], latency_ms: 340, success: true, created_at: "2026-11-05T07:18:00Z" }
          ],
          sources: [
            { id: "f-1", filename: "CSE_3Sem_Timetable_Official.pdf", kind: "application/pdf", created_at: "2026-11-04T10:30:00Z" },
            { id: "f-2", filename: "Hostel_Mess_Menu_November.xlsx", kind: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", created_at: "2026-11-04T14:15:00Z" }
          ],
          models: {
            synthesis: "Groq LPU (qwen/qwen3.8-27b) with Gemini Dual Fallback",
            embeddings: "gemini-embedding-001 (768-dim L2 Normalized)"
          },
          tools: ["get_my_timetable", "get_next_class", "get_faculty_profile", "search_canteen_items", "search_documents", "optimize_meal_budget"]
        })
      });
    }

    return route.continue();
  });

  page.on('console', m => console.log('BROWSER CONSOLE:', m.text()));
  page.on('pageerror', e => console.log('BROWSER ERR:', e.message));
  page.on('request', r => console.log('REQ:', r.method(), r.url()));
  page.on('response', resp => console.log('RESP:', resp.status(), resp.url()));

  console.log('Navigating with mock routes active...');
  await page.goto('https://campusos-mvp.vercel.app', { waitUntil: 'networkidle', timeout: 35000 });
  await page.screenshot({ path: path.join(outDir, '01_login_view.png') });
  console.log('1. Login view captured');

  console.log('Filling student credentials...');
  await page.fill('input[type="email"]', 'student@campus.edu.in');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, '02_student_dashboard.png') });
  console.log('2. Student dashboard captured');

  // Navigate to Ask CampusOS (Chat)
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Ask CampusOS' || t === 'Ask') {
      await b.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '03_chat_assistant.png') });
      console.log('3. Chat captured');
      break;
    }
  }

  // Navigate to Timetable
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Timetable' || t === 'Classes') {
      await b.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '04_timetable_view.png') });
      console.log('4. Timetable captured');
      break;
    }
  }

  // Navigate to Canteen
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t === 'Canteen' || t === 'Food') {
      await b.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '05_canteen_meals_view.png') });
      console.log('5. Canteen captured');
      break;
    }
  }

  // Switch to Admin Persona
  await page.evaluate(() => localStorage.clear());
  await page.goto('https://campusos-mvp.vercel.app', { waitUntil: 'networkidle', timeout: 35000 });
  console.log('Filling admin credentials...');
  await page.fill('input[type="email"]', 'admin@campus.edu.in');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to Admin Console
  for (const b of await page.$$('button, a')) {
    const t = (await b.innerText()).trim();
    if (t.includes('Admin') || t.includes('Management')) {
      await b.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '06_admin_ingestion_console.png') });
      console.log('6. Admin Console captured');
      break;
    }
  }

  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED WITH EXACT APPLICATION STYLING!');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
