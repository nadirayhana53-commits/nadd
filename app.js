(() => {
  "use strict";

  const CONFIG = window.APP_CONFIG || {};
  const DEFAULT_COURSES = [
    { name: "Pemrograman Web", code: "PW", sks: 3 },
    { name: "Basis Data Lanjut", code: "BD", sks: 3 },
    { name: "Interaksi Manusia & Komputer", code: "IM", sks: 3 },
    { name: "Jaringan Komputer", code: "JK", sks: 3 },
    { name: "Rekayasa Perangkat Lunak", code: "RP", sks: 3 },
    { name: "Sistem Operasi", code: "SO", sks: 3 }
  ];
  const $ = (id) => document.getElementById(id);
  const state = {
    db: null, tasks: [], courses: [], editingTaskId: null, activeFilter: "pending",
    calendarDate: new Date(), selectedDate: dateKey(new Date()),
    toastTimer: null
  };

  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function prettyDate(value, options = {day:"2-digit",month:"short",year:"numeric"}) {
    if (!value) return "Belum ditentukan";
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? "Belum ditentukan" : d.toLocaleDateString("id-ID", options);
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  function setFeedback(id, message, error = false) {
    const el = $(id);
    if (el) {
      el.textContent = message;
      el.style.color = error ? "#a33d2d" : "#55754b";
    }
  }
  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
  function initProfile() {
    const name = CONFIG.STUDENT_NAME || "Mahasiswa";
    $("studentName").textContent = name;
    $("welcomeName").textContent = name.split(" ")[0];
    $("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "M";
    $("studentMeta").textContent = `${CONFIG.STUDENT_PROGRAM || "Program Studi"} · ${CONFIG.STUDENT_SEMESTER || "Semester"}`;
    const now = new Date();
    $("todayLabel").textContent = now.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
  }
  function initSupabase() {
    const url = CONFIG.SUPABASE_URL;
    const key = CONFIG.SUPABASE_ANON_KEY;
    if (!url || !key || url.includes("MASUKKAN_") || key.includes("MASUKKAN_")) {
      return false;
    }
    if (!window.supabase?.createClient) return false;
    state.db = window.supabase.createClient(url, key);
    return true;
  }
  async function loadCourses() {
    if (state.db) {
      const { data, error } = await state.db.from("courses").select("*").order("name");
      if (error) {
        console.error(error);
        showToast("Gagal memuat mata kuliah: " + error.message);
        return;
      }
      state.courses = data || [];
    } else {
      const saved = localStorage.getItem("kumpul_courses");
      state.courses = saved ? JSON.parse(saved) : DEFAULT_COURSES.map((c, i) => ({ id: `local-${i}`, ...c }));
      localStorage.setItem("kumpul_courses", JSON.stringify(state.courses));
    }
    courseOptions();
    renderCourseChips();
  }

  function saveLocalCourses() {
    localStorage.setItem("kumpul_courses", JSON.stringify(state.courses));
  }

  function courseOptions() {
    const options = state.courses.map(c =>
      `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`
    ).join("");
    ["dashboardCourseFilter", "taskCourseFilter"].forEach(id => {
      const el = $(id);
      const previous = el.value;
      el.innerHTML = `<option value="">Semua mata kuliah</option>${options}`;
      if (state.courses.some(c => c.name === previous)) el.value = previous;
    });
    $("newTaskCourse").innerHTML = `<option value="">Pilih mata kuliah</option>${options}`;
  }

  function renderCourseChips() {
    $("courseChips").innerHTML = state.courses.map(c => `
      <button class="course-chip" data-course="${escapeHTML(c.name)}">
        <span class="course-badge">${escapeHTML(c.code)}</span><span>${escapeHTML(c.name)}</span>
      </button>`).join("");
    $("courseGrid").innerHTML = state.courses.length ? state.courses.map(c => {
      const count = state.tasks.filter(t => t.course === c.name).length;
      return `<article class="course-card-large">
        <span class="course-badge">${escapeHTML(c.code)}</span>
        <h3>${escapeHTML(c.name)}</h3>
        <p>${Number(c.sks) || 0} SKS · Semester berjalan</p>
        <span>${count} tugas terdaftar</span>
        <div class="course-actions">
          <button class="mini-button" data-edit-course="${escapeHTML(c.id)}"><i data-lucide="pencil"></i> Edit</button>
          <button class="mini-button" data-delete-course="${escapeHTML(c.id)}"><i data-lucide="trash-2"></i> Hapus</button>
        </div>
      </article>`;
    }).join("") : `<div class="loading-state">Belum ada mata kuliah. Klik Tambah mata kuliah.</div>`;
    $("statCourses").textContent = state.courses.length;
    $("courseCountLabel").textContent = `${state.courses.length} mata kuliah aktif`;
    refreshIcons();
  }

  async function addCourse() {
    const name = prompt("Nama mata kuliah:");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    if (state.courses.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast("Mata kuliah sudah terdaftar."); return;
    }
    const code = prompt("Kode mata kuliah (contoh: PW):");
    if (!code || !code.trim()) return;
    const sks = Number(prompt("Jumlah SKS:", "3"));
    if (!Number.isInteger(sks) || sks < 1 || sks > 10) {
      showToast("SKS harus berupa angka 1 sampai 10."); return;
    }
    const payload = { name: cleanName, code: code.trim().toUpperCase(), sks };
    if (state.db) {
      const { error } = await state.db.from("courses").insert(payload);
      if (error) { showToast("Gagal menambahkan: " + error.message); return; }
    } else {
      state.courses.push({ id: `local-${Date.now()}`, ...payload });
      saveLocalCourses();
    }
    await loadCourses();
    renderAll();
    showToast("Mata kuliah berhasil ditambahkan.");
  }

  async function editCourse(id) {
    const course = state.courses.find(c => String(c.id) === String(id));
    if (!course) return;
    const oldName = course.name;
    const name = prompt("Nama mata kuliah:", course.name);
    if (!name || !name.trim()) return;
    const code = prompt("Kode mata kuliah:", course.code);
    if (!code || !code.trim()) return;
    const sks = Number(prompt("Jumlah SKS:", String(course.sks || 3)));
    if (!Number.isInteger(sks) || sks < 1 || sks > 10) {
      showToast("SKS harus berupa angka 1 sampai 10."); return;
    }
    const updated = { name: name.trim(), code: code.trim().toUpperCase(), sks };
    if (state.db) {
      const { error } = await state.db.from("courses").update(updated).eq("id", id);
      if (error) { showToast("Gagal mengubah: " + error.message); return; }
      const { error: taskError } = await state.db.from("tasks").update({ course: updated.name }).eq("course", oldName);
      if (taskError) { showToast("Mata kuliah diubah, tetapi nama pada tugas gagal diperbarui: " + taskError.message); }
      await loadTasks();
    } else {
      course.name = updated.name; course.code = updated.code; course.sks = updated.sks;
      state.tasks.forEach(t => { if (t.course === oldName) t.course = updated.name; });
      saveLocalCourses();
      localStorage.setItem("kumpul_tasks", JSON.stringify(state.tasks));
    }
    await loadCourses();
    renderAll();
    showToast("Mata kuliah berhasil diperbarui.");
  }

  async function deleteCourse(id) {
    const course = state.courses.find(c => String(c.id) === String(id));
    if (!course) return;
    if (state.tasks.some(t => t.course === course.name)) {
      showToast("Tidak bisa dihapus karena masih digunakan oleh tugas."); return;
    }
    if (!confirm(`Hapus mata kuliah "${course.name}"?`)) return;
    if (state.db) {
      const { error } = await state.db.from("courses").delete().eq("id", id);
      if (error) { showToast("Gagal menghapus: " + error.message); return; }
    } else {
      state.courses = state.courses.filter(c => String(c.id) !== String(id));
      saveLocalCourses();
    }
    await loadCourses();
    renderAll();
    showToast("Mata kuliah berhasil dihapus.");
  }

  function normalizedTask(t) {
    return {
      ...t,
      title: t.title || t.task_name || "Tugas tanpa judul",
      course: t.course || "Mata kuliah belum diisi",
      status: t.status === "submitted" ? "submitted" : "pending",
      priority: ["high","normal","low"].includes(t.priority) ? t.priority : "normal",
      due_date: t.due_date || null
    };
  }
  async function loadTasks() {
    if (!state.db) {
      state.tasks = loadDemoTasks();
      renderAll();
      showToast("Mode pratinjau aktif. Hubungkan Supabase untuk sinkronisasi online.");
      return;
    }
    $("dashboardTaskList").innerHTML = `<div class="loading-state">Memuat daftar tugas...</div>`;
    const { data, error } = await state.db.from("tasks").select("*").order("created_at",{ascending:false});
    if (error) {
      console.error(error);
      $("dashboardTaskList").innerHTML = `<div class="loading-state">Data belum dapat dimuat. Periksa konfigurasi Supabase dan jalankan supabase.sql.</div>`;
      showToast("Gagal memuat data: " + error.message);
      return;
    }
    state.tasks = (data || []).map(normalizedTask);
    renderAll();
  }
  function loadDemoTasks() {
    const today = new Date();
    const addDays = n => { const d = new Date(today); d.setDate(d.getDate()+n); return dateKey(d); };
    return [
      {id:"demo1",title:"Implementasi REST API",course:"Pemrograman Web",due_date:addDays(0),priority:"high",status:"pending",description:"Membangun endpoint REST API"},
      {id:"demo2",title:"Normalisasi basis data",course:"Basis Data Lanjut",due_date:addDays(1),priority:"normal",status:"pending"},
      {id:"demo3",title:"Studi kasus: evaluasi heuristik",course:"Interaksi Manusia & Komputer",due_date:addDays(3),priority:"normal",status:"pending"},
      {id:"demo4",title:"Simulasi routing jaringan",course:"Jaringan Komputer",due_date:addDays(5),priority:"low",status:"pending"},
      {id:"demo5",title:"Dokumentasi kebutuhan sistem",course:"Rekayasa Perangkat Lunak",due_date:addDays(-1),priority:"normal",status:"submitted",submitted_at:new Date().toISOString(),file_name:"dokumentasi.pdf"},
      {id:"demo6",title:"Laporan praktikum sistem operasi",course:"Sistem Operasi",due_date:addDays(-2),priority:"normal",status:"submitted",submitted_at:new Date().toISOString(),file_name:"laporan.docx"}
    ];
  }
  function renderAll() {
    renderCourseChips();
    renderStats();
    renderDashboardTasks();
    renderQuickSelect();
    renderAgenda();
    renderAllTasks();
    renderHistory();
    renderCalendar();
    refreshIcons();
  }
  function renderStats() {
    const total = state.tasks.length;
    const submitted = state.tasks.filter(t => t.status === "submitted").length;
    const pending = total - submitted;
    const pct = total ? Math.round(submitted / total * 100) : 0;
    $("statTotal").textContent = total;
    $("statPending").textContent = pending;
    $("statSubmitted").textContent = submitted;
    $("navPending").textContent = String(pending).padStart(2,"0");
    $("tabPending").textContent = String(pending).padStart(2,"0");
    $("tabSubmitted").textContent = String(submitted).padStart(2,"0");
    $("tabAll").textContent = String(total).padStart(2,"0");
    $("progressPercent").textContent = `${pct}%`;
    $("progressRing").style.setProperty("--progress",`${pct}%`);
    $("weeklyText").textContent = `${submitted} dari ${total} tugas terkirim`;
    $("weeklyEncouragement").textContent = pct === 100 && total ? "Semua tugas terselesaikan!" : pct >= 60 ? "Terus pertahankan!" : "Sedikit demi sedikit, ya!";
    const dueSoon = state.tasks.filter(t => t.status !== "submitted" && t.due_date && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 2).length;
    $("attentionText").textContent = dueSoon ? `${dueSoon} tugas perlu perhatian dalam 2 hari ini` : "Semua aman. Periksa tenggat berikutnya.";
    $("pendingHint").textContent = `${dueSoon} mendekati tenggat`;
  }
  function daysUntil(date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(`${date}T00:00:00`);
    return Math.round((due - today) / 86400000);
  }
  function taskSymbol(course) {
    if (/basis/i.test(course)) return "database";
    if (/jaringan/i.test(course)) return "network";
    if (/interaksi/i.test(course)) return "panels-top-left";
    if (/sistem operasi/i.test(course)) return "monitor";
    if (/rekayasa/i.test(course)) return "workflow";
    return "code";
  }
  function dueLabel(task) {
    if (!task.due_date) return "Tenggat belum diatur";
    const diff = daysUntil(task.due_date);
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Besok";
    if (diff < 0) return `Terlambat ${Math.abs(diff)} hari`;
    return prettyDate(task.due_date,{day:"numeric",month:"short"});
  }
  function taskRow(t) {
    const status = t.status === "submitted" ? "submitted" : "pending";
    const priorityText = t.priority === "high" ? "Segera" : t.priority === "low" ? "Santai" : "Normal";
    return `<article class="task-row">
      <span class="task-symbol"><i data-lucide="${taskSymbol(t.course)}"></i></span>
      <div class="task-main"><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.course)}</small><small class="due-line"><i data-lucide="clock-3" style="width:10px;height:10px;vertical-align:middle"></i> ${escapeHTML(dueLabel(t))}</small></div>
      <div class="task-meta"><span class="priority ${t.priority}">${priorityText}</span><span class="status-pill ${status}">${status === "submitted" ? "Terkumpul" : "Perlu dikerjakan"}</span></div>
      <button class="task-open" data-task-detail="${escapeHTML(t.id)}" aria-label="Lihat detail tugas"><i data-lucide="chevron-right"></i></button>
    </article>`;
  }
  function renderDashboardTasks() {
    const filter = state.activeFilter;
    const course = $("dashboardCourseFilter").value;
    let list = state.tasks.filter(t => filter === "all" || t.status === filter);
    if (course) list = list.filter(t => t.course === course);
    list.sort((a,b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    $("dashboardTaskList").innerHTML = list.length ? list.slice(0,4).map(taskRow).join("") : `<div class="loading-state">Belum ada tugas pada kategori ini.</div>`;
    $("taskListSummary").textContent = `Menampilkan ${Math.min(list.length,4)} dari ${list.length} tugas`;
    refreshIcons();
  }
  function renderQuickSelect() {
    const pending = state.tasks.filter(t => t.status !== "submitted");
    $("quickTaskSelect").innerHTML = `<option value="">Pilih tugas yang belum dikumpulkan</option>` +
      pending.map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.title)}</option>`).join("");
    if (!pending.length) $("quickTaskSelect").innerHTML = `<option value="">Tidak ada tugas yang menunggu</option>`;
  }
  function renderAgenda() {
    const upcoming = state.tasks.filter(t => t.status !== "submitted" && t.due_date && daysUntil(t.due_date) >= -1)
      .sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,3);
    $("upcomingAgenda").innerHTML = upcoming.length ? upcoming.map(t => {
      const d = new Date(`${t.due_date}T00:00:00`);
      return `<div class="agenda-item"><div class="agenda-date"><small>${d.toLocaleDateString("id-ID",{month:"short"})}</small><strong>${d.getDate()}</strong></div><div><strong>${escapeHTML(t.title)}</strong><p>${escapeHTML(t.course)} · ${escapeHTML(dueLabel(t))}</p></div></div>`;
    }).join("") : `<div class="loading-state">Belum ada tenggat terdekat.</div>`;
  }
  function renderAllTasks() {
    const keyword = ($("taskSearch")?.value || $("globalSearch").value || "").toLowerCase().trim();
    const course = $("taskCourseFilter").value;
    const status = $("taskStatusFilter").value;
    const list = state.tasks.filter(t =>
      (!keyword || `${t.title} ${t.course}`.toLowerCase().includes(keyword)) &&
      (!course || t.course === course) &&
      (!status || t.status === status)
    ).sort((a,b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    $("allTasksTable").innerHTML = list.length ? list.map(t => `
      <tr><td><strong>${escapeHTML(t.title)}</strong><br><span style="color:#8b8073;font-size:9px">${escapeHTML(t.description || "")}</span></td>
      <td>${escapeHTML(t.course)}</td><td>${escapeHTML(prettyDate(t.due_date))}</td>
      <td><span class="priority ${t.priority}">${t.priority === "high" ? "Segera" : t.priority === "low" ? "Santai" : "Normal"}</span></td>
      <td><span class="status-pill ${t.status}">${t.status === "submitted" ? "Terkumpul" : "Belum dikumpulkan"}</span></td>
      <td><div class="table-actions">
        ${t.status === "pending" ? `<button class="mini-button" data-quick-for="${escapeHTML(t.id)}">Kumpulkan</button>` : `<button class="mini-button" data-download-task="${escapeHTML(t.id)}">Unduh</button><button class="mini-button" data-replace-file="${escapeHTML(t.id)}">Ganti file</button>`}
        <button class="mini-button" data-edit-task="${escapeHTML(t.id)}" title="Edit tugas"><i data-lucide="pencil"></i></button>
        <button class="mini-button" data-delete-task="${escapeHTML(t.id)}" title="Hapus tugas"><i data-lucide="trash-2"></i></button>
      </div></td></tr>
    `).join("") : `<tr><td colspan="6" class="empty-cell">Tidak ada tugas yang cocok.</td></tr>`;
  }
  function renderHistory() {
    const list = state.tasks.filter(t => t.status === "submitted").sort((a,b) => String(b.submitted_at || b.created_at || "").localeCompare(String(a.submitted_at || a.created_at || "")));
    $("historyList").innerHTML = list.length ? list.map(t => `<div class="history-item"><span class="task-symbol"><i data-lucide="file-check-2"></i></span><div><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.course)} · Dikumpulkan ${t.submitted_at ? new Date(t.submitted_at).toLocaleDateString("id-ID") : "—"}</small></div><div class="history-actions">${t.file_path ? `<button class="mini-button" data-download-task="${escapeHTML(t.id)}">Download file</button>` : `<span class="status-pill submitted">Terkumpul</span>`}<button class="mini-button" data-edit-task="${escapeHTML(t.id)}">Edit</button><button class="mini-button" data-delete-task="${escapeHTML(t.id)}">Hapus</button><button class="mini-button" data-replace-file="${escapeHTML(t.id)}">Ganti file</button></div></div>`).join("") : `<div class="loading-state">Belum ada riwayat pengumpulan.</div>`;
    refreshIcons();
  }
  function renderCalendar() {
    const d = state.calendarDate;
    const year = d.getFullYear(), month = d.getMonth();
    $("calendarMonth").textContent = d.toLocaleDateString("id-ID",{month:"long",year:"numeric"});
    const first = new Date(year,month,1);
    const startOffset = (first.getDay()+6)%7;
    const start = new Date(year,month,1-startOffset);
    const weekdays = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
    let html = weekdays.map(w => `<div class="calendar-weekday">${w}</div>`).join("");
    for (let i=0;i<42;i++) {
      const day = new Date(start); day.setDate(start.getDate()+i);
      const key = dateKey(day);
      const hasTask = state.tasks.some(t => t.due_date === key);
      const classes = ["calendar-day",day.getMonth()!==month?"muted":"",key===dateKey(new Date())?"today":"",key===state.selectedDate?"selected":""].filter(Boolean).join(" ");
      html += `<button class="${classes}" data-calendar-date="${key}">${day.getDate()}${hasTask?'<span class="day-dot"></span>':""}</button>`;
    }
    $("calendarGrid").innerHTML = html;
    renderSelectedDate();
  }
  function renderSelectedDate() {
    const key = state.selectedDate;
    $("selectedDateTitle").textContent = prettyDate(key,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const list = state.tasks.filter(t => t.due_date === key);
    $("selectedDateTasks").innerHTML = list.length ? list.map(t => `<div class="selected-date-item"><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.course)} · ${t.status === "submitted" ? "Terkumpul" : "Belum dikumpulkan"}</small></div>`).join("") : `<div class="loading-state">Tidak ada tenggat pada tanggal ini.</div>`;
  }
  async function uploadSubmission(taskId,file) {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) throw new Error("Tugas tidak ditemukan.");
    if (!state.db) {
      task.status = "submitted"; task.file_name = file.name; task.submitted_at = new Date().toISOString();
      localStorage.setItem("kumpul_tasks", JSON.stringify(state.tasks));
      renderAll(); return;
    }
    const ext = file.name.split(".").pop().toLowerCase();
    const allowed = ["pdf","doc","docx","ppt","pptx","zip"];
    if (!allowed.includes(ext)) throw new Error("Format file tidak didukung.");
    if (file.size > 20*1024*1024) throw new Error("Ukuran file maksimal 20 MB.");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path = `submissions/${Date.now()}_${crypto.randomUUID()}_${safe}`;
    const {error:uploadError} = await state.db.storage.from("task-files").upload(path,file,{upsert:false,contentType:file.type || undefined});
    if (uploadError) throw uploadError;
    const {error:updateError} = await state.db.from("tasks").update({
      status:"submitted",file_name:file.name,file_path:path,submitted_at:new Date().toISOString()
    }).eq("id",taskId);
    if (updateError) {
      await state.db.storage.from("task-files").remove([path]);
      throw updateError;
    }
    if (task.file_path && task.file_path !== path) {
      await state.db.storage.from("task-files").remove([task.file_path]);
    }
    await loadTasks();
  }
  async function createTask(payload) {
    if (!state.db) {
      state.tasks.unshift({id:`local-${Date.now()}`,...payload,status:"pending",created_at:new Date().toISOString()});
      localStorage.setItem("kumpul_tasks", JSON.stringify(state.tasks));
      renderAll(); return;
    }
    const {error} = await state.db.from("tasks").insert({
      title:payload.title,course:payload.course,description:payload.description,
      due_date:payload.due_date || null,priority:payload.priority,status:"pending"
    });
    if (error) throw error;
    await loadTasks();
  }
  async function updateTask(taskId, payload) {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) throw new Error("Tugas tidak ditemukan.");
    if (state.db) {
      const { error } = await state.db.from("tasks").update({
        title: payload.title, course: payload.course, description: payload.description,
        due_date: payload.due_date || null, priority: payload.priority
      }).eq("id", taskId);
      if (error) throw error;
      await loadTasks();
    } else {
      Object.assign(task, payload);
      localStorage.setItem("kumpul_tasks", JSON.stringify(state.tasks));
      renderAll();
    }
  }

  async function deleteTask(taskId) {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    if (!confirm(`Hapus tugas "${task.title}" beserta data pengumpulannya?`)) return;
    if (state.db) {
      const { error } = await state.db.from("tasks").delete().eq("id", taskId);
      if (error) { showToast("Gagal menghapus tugas: " + error.message); return; }
      if (task.file_path) {
        const { error: fileError } = await state.db.storage.from("task-files").remove([task.file_path]);
        if (fileError) console.warn("File lama tidak terhapus:", fileError.message);
      }
      await loadTasks();
    } else {
      state.tasks = state.tasks.filter(t => String(t.id) !== String(taskId));
      localStorage.setItem("kumpul_tasks", JSON.stringify(state.tasks));
      renderAll();
    }
    showToast("Tugas berhasil dihapus.");
  }

  function editTask(taskId) {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    state.editingTaskId = taskId;
    $("modalTitle").textContent = "Edit tugas";
    $("saveTaskButton").textContent = "Simpan perubahan";
    $("newTaskTitle").value = task.title;
    $("newTaskCourse").value = task.course;
    $("newTaskDue").value = task.due_date || "";
    $("newTaskPriority").value = task.priority || "normal";
    $("newTaskDescription").value = task.description || "";
    $("modalBackdrop").hidden = false;
    $("newTaskTitle").focus();
  }

  async function replaceSubmission(taskId, file) {
    if (!file) return;
    await uploadSubmission(taskId, file);
    showToast("File tugas berhasil diperbarui.");
  }

  async function downloadTask(taskId) {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    if (!task.file_path) { showToast("Belum ada file yang diunggah untuk tugas ini."); return; }
    if (!state.db) { showToast("Mode pratinjau: file belum tersimpan di Supabase."); return; }
    const {data,error} = await state.db.storage.from("task-files").createSignedUrl(task.file_path,60);
    if (error) { showToast("Gagal membuat link download: "+error.message); return; }
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }
  function openModal() {
    state.editingTaskId = null;
    $("modalTitle").textContent = "Tambah tugas";
    $("saveTaskButton").textContent = "Simpan tugas";
    $("taskForm").reset();
    $("modalBackdrop").hidden = false;
    $("newTaskTitle").focus();
  }
  function closeModal() {
    $("modalBackdrop").hidden = true;
    $("taskForm").reset();
    state.editingTaskId = null;
    $("modalTitle").textContent = "Tambah tugas";
    $("saveTaskButton").textContent = "Simpan tugas";
    setFeedback("taskFeedback","");
  }
  function showView(view) {
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active",el.id === `view-${view}`));
    document.querySelectorAll(".nav-item[data-view]").forEach(el => el.classList.toggle("active",el.dataset.view === view));
    const titles = {
      dashboard:["Dashboard","Ruang untuk setiap progres belajarmu."],
      tasks:["Tugas saya","Atur dan pantau seluruh tugas kuliahmu."],
      courses:["Mata kuliah","Ruang belajar untuk setiap mata kuliah."],
      calendar:["Kalender","Pantau tenggat dan agenda akademik."],
      history:["Riwayat","Semua pengumpulan tugas yang sudah tercatat."]
    };
    $("pageTitle").textContent = titles[view][0];
    $("pageSubtitle").textContent = titles[view][1];
    if (view === "calendar") renderCalendar();
    $("sidebar").classList.remove("open");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click",()=>showView(b.dataset.view)));
    document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click",()=>showView(b.dataset.go)));
    $("menuButton").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("refreshButton").addEventListener("click",loadTasks);
    $("dashboardCourseFilter").addEventListener("change",renderDashboardTasks);
    document.querySelectorAll("[data-task-filter]").forEach(b => b.addEventListener("click",()=>{
      state.activeFilter=b.dataset.taskFilter;
      document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));
      renderDashboardTasks();
    }));
    $("courseChips").addEventListener("click",e=>{
      const b=e.target.closest("[data-course]"); if(!b)return;
      $("taskCourseFilter").value=b.dataset.course; showView("tasks"); renderAllTasks();
    });
    ["taskSearch","taskCourseFilter","taskStatusFilter"].forEach(id=>$(id).addEventListener("input",renderAllTasks));
    $("globalSearch").addEventListener("input",()=>{
      $("taskSearch").value=$("globalSearch").value;
      if ($("globalSearch").value.trim()) showView("tasks");
      renderAllTasks();
    });
    document.addEventListener("keydown",e=>{
      if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault(); $("globalSearch").focus();
      }
      if (e.key === "Escape") closeModal();
    });
    $("addTaskButton").addEventListener("click",openModal);
    $("closeModal").addEventListener("click",closeModal);
    $("cancelModal").addEventListener("click",closeModal);
    $("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal();});
    $("taskForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const button=$("saveTaskButton");button.disabled=true;button.textContent="Menyimpan...";
      try{
        const payload = {
          title:$("newTaskTitle").value.trim(),course:$("newTaskCourse").value,
          due_date:$("newTaskDue").value || null,priority:$("newTaskPriority").value,
          description:$("newTaskDescription").value.trim()
        };
        if (state.editingTaskId !== null) {
          await updateTask(state.editingTaskId, payload);
          closeModal();showToast("Perubahan tugas berhasil disimpan.");
        } else {
          await createTask(payload);
          closeModal();showToast("Tugas berhasil ditambahkan.");
        }
        showView("tasks");
      }catch(err){console.error(err);setFeedback("taskFeedback","Gagal menyimpan: "+err.message,true);}
      finally{button.disabled=false;button.textContent="Simpan tugas";}
    });
    $("quickFile").addEventListener("change",()=>{
      const f=$("quickFile").files[0];$("filePicked").textContent=f?f.name:"";$("dropTitle").textContent=f?"File siap dikirim":"Tarik file ke sini atau pilih file";
    });
    const zone=$("dropZone");
    ["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("dragover");}));
    ["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("dragover");}));
    zone.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f){$("quickFile").files=e.dataTransfer.files;$("filePicked").textContent=f.name;$("dropTitle").textContent="File siap dikirim";}});
    $("quickUploadForm").addEventListener("submit",async e=>{
      e.preventDefault();const id=$("quickTaskSelect").value,file=$("quickFile").files[0];
      if(!id||!file){setFeedback("uploadFeedback","Pilih tugas dan file terlebih dahulu.",true);return;}
      const btn=$("uploadSubmit");btn.disabled=true;btn.innerHTML="Mengunggah...";
      try{await uploadSubmission(id,file);$("quickUploadForm").reset();$("filePicked").textContent="";$("dropTitle").textContent="Tarik file ke sini atau pilih file";setFeedback("uploadFeedback","Berhasil dikumpulkan.");showToast("Tugas berhasil dikumpulkan.");}
      catch(err){console.error(err);setFeedback("uploadFeedback","Upload gagal: "+err.message,true);}
      finally{btn.disabled=false;btn.innerHTML='<i data-lucide="upload"></i> Kumpulkan tugas';refreshIcons();}
    });
    $("dashboardTaskList").addEventListener("click",e=>{
      const b=e.target.closest("[data-task-detail]");if(!b)return;
      const task=state.tasks.find(t=>String(t.id)===b.dataset.taskDetail);
      if(task){showView("tasks");$("taskSearch").value=task.title;renderAllTasks();}
    });
    const handleTaskAction = e => {
      const quick=e.target.closest("[data-quick-for]");
      const down=e.target.closest("[data-download-task]");
      const edit=e.target.closest("[data-edit-task]");
      const del=e.target.closest("[data-delete-task]");
      const replace=e.target.closest("[data-replace-file]");
      if(quick){$("quickTaskSelect").value=quick.dataset.quickFor;showView("dashboard");$("quickUploadPanel").scrollIntoView({behavior:"smooth"});}
      if(down) downloadTask(down.dataset.downloadTask);
      if(edit) editTask(edit.dataset.editTask);
      if(del) deleteTask(del.dataset.deleteTask);
      if(replace) {
        $("replaceFileTaskId").value = replace.dataset.replaceFile;
        $("replaceTaskFile").click();
      }
    };
    $("allTasksTable").addEventListener("click",handleTaskAction);
    $("historyList").addEventListener("click",handleTaskAction);
    $("replaceTaskFile").addEventListener("change",async e=>{
      const file=e.target.files[0], id=$("replaceFileTaskId").value;
      if(!file || !id) return;
      try { await replaceSubmission(id,file); await loadTasks(); }
      catch(err) { console.error(err); showToast("Gagal mengganti file: " + err.message); }
      finally { e.target.value=""; $("replaceFileTaskId").value=""; }
    });
    $("prevMonth").addEventListener("click",()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()-1);renderCalendar();});
    $("nextMonth").addEventListener("click",()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()+1);renderCalendar();});
    $("todayButton").addEventListener("click",()=>{state.calendarDate=new Date();state.selectedDate=dateKey(new Date());renderCalendar();});
    $("calendarGrid").addEventListener("click",e=>{const b=e.target.closest("[data-calendar-date]");if(!b)return;state.selectedDate=b.dataset.calendarDate;renderCalendar();});
    $("notificationButton").addEventListener("click",()=>showToast($("attentionText").textContent));
    $("editProfileButton").addEventListener("click",()=>showToast("Nama dan program studi dapat diubah di file config.js."));
    $("addCourseButton").addEventListener("click",addCourse);
    $("courseGrid").addEventListener("click",e=>{
      const edit=e.target.closest("[data-edit-course]");
      const del=e.target.closest("[data-delete-course]");
      if(edit) editCourse(edit.dataset.editCourse);
      if(del) deleteCourse(del.dataset.deleteCourse);
    });
  }
  function init() {
    initProfile();bindEvents();refreshIcons();
    const connected=initSupabase();
    if (!connected) showToast("Mode lokal aktif. Isi config.js untuk sinkronisasi Supabase.");
    (async () => { await loadCourses(); await loadTasks(); })();
  }
  document.addEventListener("DOMContentLoaded",init);
})();