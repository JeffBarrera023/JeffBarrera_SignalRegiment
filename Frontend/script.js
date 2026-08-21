async function checkAuthentication() {

    try {

        const response =
            await fetch("/api/auth/me");


        if (!response.ok) {

            window.location.href =
                "/";

            return null;
        }


        const data =
            await response.json();


        return data.user;

    } catch (error) {

        console.error(
            "Authentication check failed:",
            error
        );

        window.location.href =
            "/";

        return null;
    }
}

async function initializeDashboard() {

    const user =
        await checkAuthentication();

    if (!user) {
        return;
    }

    console.log(
        "Logged-in user:",
        user
    );

    await Promise.all([fetchOverallNumbers(), loadEmployees()]);
    await loadChartData();
    renderTable();

}


initializeDashboard();

let employees = [];

const levelOrder = {
  Recruit: 1,
  'Private': 2,
  'Corporal': 3,
  'Sergeant': 4,
  'Lieutenant': 5,
  Captain: 6,
  Major: 7,
  Colonel: 8,
  Staff: 9
};

const tbody = document.querySelector('tbody');
const departmentFilter = document.getElementById('departmentFilter');
const sortBy = document.getElementById('sortBy');
const employeeSearch = document.getElementById('employeeSearch');
const detailPanel = document.getElementById('employeeDetails');
const chartBreakdown = document.getElementById('chartBreakdown');
const pieChart = document.querySelector('.pie-chart');
const legend = document.querySelector('.legend');
const chartCenter = document.querySelector('.chart-center');
const addPersonnelButton = document.getElementById('addPersonnelButton');
const previousPageButton = document.getElementById('previousPage');
const nextPageButton = document.getElementById('nextPage');
const pageStatus = document.getElementById('pageStatus');
const pageSize = 5;
let currentPage = 1;
let chartData = [];

async function fetchOverallNumbers() {
  try {
    const response = await fetch('/api/personnel/summary');

    if (!response.ok) {
      throw new Error(`Summary request failed with status ${response.status}`);
    }

    const { summary } = await response.json();
    document.getElementById('totalEmployees').textContent = summary.totalEmployees;
    document.getElementById('activeEmployees').textContent = summary.active;
    document.getElementById('traineeEmployees').textContent = summary.traineeEmployees;
    document.getElementById('resignedEmployees').textContent = summary.resigned;
  } catch (error) {
    console.error('Unable to load overall personnel numbers:', error);
  }
}

async function loadEmployees() {
  try {
    const response = await fetch('/api/personnel');

    if (!response.ok) {
      throw new Error(`Employee list request failed with status ${response.status}`);
    }

    const data = await response.json();
    employees = data.employees;
  } catch (error) {
    console.error('Unable to load employee list:', error);
    employees = [];
  }
}

const chartColors = ['#9db386', '#80bb76', '#4c9642', '#3d6824', '#2b411c', '#849c78'];

function updateSummary() {
  fetchOverallNumbers();
}

function getFilteredEmployees() {
  const selectedDepartment = departmentFilter.value;
  const searchValue = employeeSearch.value.trim().toLowerCase();

  let filtered = employees.filter((employee) => {
    const matchesDepartment = selectedDepartment === 'all' || employee.department === selectedDepartment;
    const matchesSearch = !searchValue ||
      employee.name.toLowerCase().includes(searchValue) ||
      String(employee.id).includes(searchValue);

    return matchesDepartment && matchesSearch;
  });

  filtered.sort((a, b) => {
    const sortType = sortBy.value;

    if (sortType === 'department') {
      return a.department.localeCompare(b.department) || a.name.localeCompare(b.name);
    }

    if (sortType === 'level') {
      return (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0) || a.name.localeCompare(b.name);
    }

    return a.name.localeCompare(b.name);
  });

  return filtered;
}

function renderTable() {
  const filteredEmployees = getFilteredEmployees();
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  detailPanel.textContent = 'Select View/Edit for an employee to view details.';
  pageStatus.textContent = `Page ${currentPage} of ${pageCount}`;
  previousPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === pageCount;

  if (!filteredEmployees.length) {
    tbody.innerHTML = '<tr><td colspan="6">No employees match this filter.</td></tr>';
    detailPanel.textContent = 'No employee selected.';
    return;
  }

  const pageStart = (currentPage - 1) * pageSize;
  const pageEmployees = filteredEmployees.slice(pageStart, pageStart + pageSize);

  tbody.innerHTML = pageEmployees
    .map(
      (employee) => `
        <tr data-id="${employee.id}">
          <td>${employee.id}</td>
          <td>${employee.name}</td>
          <td>${employee.department}</td>
          <td>${employee.level}</td>
          <td><span class="status ${employee.status.toLowerCase()}">${employee.status}</span></td>
          <td>
            <div class="action-group">
              <button class="table-btn view-btn" data-id="${employee.id}">View/Edit</button>
              <button class="table-btn remove-btn" data-id="${employee.id}">Remove</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  document.querySelectorAll('.view-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      const { id } = event.currentTarget.dataset;
      showEmployeeDetails(id);
    });
  });

  document.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      const { id } = event.currentTarget.dataset;
      const employeeIndex = employees.findIndex((person) => person.id === id);
      const employee = employees[employeeIndex];

      if (employee) {
        removeEmployee(employee);
      }
    });
  });
}

async function removeEmployee(employee) {
  const confirmed = window.confirm(
    `Delete personnel record?\n\nEmployee ID: ${employee.id}\nName: ${employee.name}`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/personnel/${encodeURIComponent(employee.id)}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to remove personnel.');
    }

    employees = employees.filter((person) => person.id !== employee.id);
    detailPanel.textContent = 'Select View/Edit for an employee to view details.';
    updateSummary();
    renderTable();
    loadChartData();
  } catch (error) {
    console.error('Remove personnel error:', error);
    window.alert(error.message);
  }
}

function renderChart() {
  const data = chartData;
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = chartColors;

  let start = 0;
  const gradientParts = data.map((item, index) => {
    const end = start + (item.value / total) * 100;
    const color = colors[index % colors.length];
    const segment = `${color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  pieChart.style.background = `conic-gradient(${gradientParts.join(', ')})`;

  const centerValue = data[0] ? `${Math.round((data[0].value / total) * 100)}%` : '0%';
  chartCenter.textContent = centerValue;

  legend.innerHTML = data
    .map((item, index) => {
      const percentage = ((item.value / total) * 100).toFixed(0);
      return `
        <li>
          <div class="legend-label">
            <span class="dot" style="background:${colors[index % colors.length]}"></span>
            ${item.label}
          </div>
          <strong>${percentage}%</strong>
        </li>
      `;
    })
    .join('');
}

async function loadChartData() {
  try {
    const response = await fetch(`/api/personnel/breakdown?by=${chartBreakdown.value}`);
    const data = await parseJsonResponse(response, 'Unable to load personnel breakdown.');

    if (!response.ok) {
      throw new Error(data.message || `Breakdown request failed with status ${response.status}`);
    }

    chartData = data.breakdown || [];
    renderChart();
  } catch (error) {
    console.error('Unable to load personnel breakdown:', error);
    chartData = [];
    renderChart();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateValue(dateValue) {
  if (!dateValue) {
    return '';
  }

  if (typeof dateValue === 'string') {
    if (dateValue.length >= 10) {
      return dateValue.slice(0, 10);
    }

    return dateValue;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const adjusted = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return adjusted.toISOString().split('T')[0];
}

function parseJsonResponse(response, errorMessage) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return response.text().then((text) => {
      const message = text.includes('<!DOCTYPE') || text.includes('<html')
        ? 'Your session may have expired. Please log in again.'
        : errorMessage;
      throw new Error(message);
    });
  }

  return response.json();
}

function populateSelectOptions(select, options, selectedValue) {
  select.innerHTML = '';

  options.forEach(({ id, name }) => {
    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = name;
    select.appendChild(option);
  });

  if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
    select.value = String(selectedValue);
  }
}

function showEmployeeDetails(employeeId) {
  const employee = employees.find((person) => person.id === employeeId);

  if (!employee) {
    detailPanel.textContent = 'Employee details not found.';
    return;
  }

  detailPanel.innerHTML = `
    <h3>${employee.name}</h3>
    <p><strong>Department:</strong> ${employee.department}</p>
    <p><strong>Level:</strong> ${employee.level}</p>
    <p><strong>Status:</strong> <span class="status ${employee.status.toLowerCase()}">${employee.status}</span></p>
    <p><strong>Phone:</strong> ${employee.phone}</p>
    <p><strong>Email:</strong> ${employee.email}</p>
    <button class="table-btn edit-btn" type="button">Edit</button>
    <button class="table-btn remove-btn detail-remove-btn" type="button">Remove</button>
  `;

  detailPanel.querySelector('.detail-remove-btn').addEventListener('click', () => {
    removeEmployee(employee);
  });

  detailPanel.querySelector('.edit-btn').addEventListener('click', async () => {
    try {
      const employeeResponse = await fetch(`/api/personnel/${encodeURIComponent(employee.id)}`);
      const employeeData = await parseJsonResponse(employeeResponse, 'Unable to load employee details.');

      if (!employeeResponse.ok) {
        throw new Error(employeeData.message || 'Unable to load employee details.');
      }

      const optionsResponse = await fetch('/api/personnel/options');
      const optionsData = await parseJsonResponse(optionsResponse, 'Unable to load personnel options.');

      if (!optionsResponse.ok) {
        throw new Error(optionsData.message || 'Unable to load personnel options.');
      }

      const employeeRecord = employeeData.employee;
      const { departments, positions, statuses } = optionsData.options;

      detailPanel.innerHTML = `
        <h3>Edit Employee: ${escapeHtml(employeeRecord.firstname || '')} ${escapeHtml(employeeRecord.middlename || '')} ${escapeHtml(employeeRecord.lastname || '')}</h3>
        <form id="editEmployeeForm" class="personnel-form">
          <div class="form-grid">
            <label class="form-field">
              First Name
              <input name="firstName" type="text" maxlength="250" value="${escapeHtml(employeeRecord.firstname || '')}" required>
            </label>
            <label class="form-field">
              Middle Name
              <input name="middleName" type="text" maxlength="250" value="${escapeHtml(employeeRecord.middlename || '')}">
            </label>
            <label class="form-field">
              Last Name
              <input name="lastName" type="text" maxlength="250" value="${escapeHtml(employeeRecord.lastname || '')}" required>
            </label>
            <label class="form-field">
              Date of Birth
              <input name="dateOfBirth" type="date" value="${formatDateValue(employeeRecord.dateofbirth)}" required>
            </label>
            <label class="form-field">
              Gender
              <select name="gender" required>
                <option value="Female" ${employeeRecord.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Male" ${employeeRecord.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Prefer not to say" ${employeeRecord.gender === 'Prefer not to say' ? 'selected' : ''}>Prefer not to say</option>
              </select>
            </label>
            <label class="form-field">
              Contact Number
              <input name="contactNumber" type="tel" inputmode="numeric" maxlength="250" pattern="[0-9]+" value="${escapeHtml(employeeRecord.contactnumber || '')}" required>
            </label>
            <label class="form-field">
              Email
              <input name="email" type="email" maxlength="250" value="${escapeHtml(employeeRecord.email || '')}" required>
            </label>
            <label class="form-field">
              Date Hired
              <input name="dateHired" type="date" value="${formatDateValue(employeeRecord.datehired)}" required>
            </label>
            <label class="form-field">
              Leave Date
              <input name="leaveDate" type="date" value="${formatDateValue(employeeRecord.leavedate)}">
            </label>
            <label class="form-field">
              Department
              <select name="department" id="editDepartment" required></select>
            </label>
            <label class="form-field">
              Position
              <select name="position" id="editPosition" required></select>
            </label>
            <label class="form-field">
              Status
              <select name="employmentStatus" id="editStatus" required></select>
            </label>
          </div>

          <div class="form-actions">
            <button class="secondary-btn" type="button" id="cancelEditButton">Cancel</button>
            <button class="primary-btn" type="submit">Save Changes</button>
          </div>
        </form>
      `;

      const departmentSelect = detailPanel.querySelector('#editDepartment');
      const positionSelect = detailPanel.querySelector('#editPosition');
      const statusSelect = detailPanel.querySelector('#editStatus');

      populateSelectOptions(departmentSelect, departments, employeeRecord.deptid);
      populateSelectOptions(positionSelect, positions, employeeRecord.positionid);
      populateSelectOptions(statusSelect, statuses, employeeRecord.statusid);

      detailPanel.querySelector('#cancelEditButton').addEventListener('click', () => {
        showEmployeeDetails(employee.id);
      });

      detailPanel.querySelector('#editEmployeeForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!event.currentTarget.reportValidity()) {
          return;
        }

        const emailField = event.currentTarget.querySelector('input[name="email"]');
        const emailValue = String(emailField.value || '').trim();
        const validEmailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

        if (!validEmailPattern.test(emailValue)) {
          emailField.setCustomValidity('Please enter a valid email address.');
          emailField.reportValidity();
          emailField.focus();
          return;
        }

        emailField.setCustomValidity('');

        const formData = new FormData(event.currentTarget);
        const payload = {
          firstName: String(formData.get('firstName') || '').trim(),
          middleName: String(formData.get('middleName') || '').trim(),
          lastName: String(formData.get('lastName') || '').trim(),
          dateOfBirth: formData.get('dateOfBirth'),
          gender: formData.get('gender'),
          contactNumber: String(formData.get('contactNumber') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          dateHired: formData.get('dateHired') || null,
          leaveDate: formData.get('leaveDate') || null,
          department: formData.get('department') || null,
          position: formData.get('position') || null,
          employmentStatus: formData.get('employmentStatus') || null
        };

        try {
          const response = await fetch(`/api/personnel/${encodeURIComponent(employee.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await parseJsonResponse(response, 'Unable to update personnel.');

          if (!response.ok) {
            throw new Error(data.message || 'Unable to update personnel.');
          }

          window.alert('Personnel details updated successfully.');
          await loadEmployees();
          renderTable();
          showEmployeeDetails(employee.id);
        } catch (error) {
          console.error('Update personnel error:', error);
          window.alert(error.message);
        }
      });
    } catch (error) {
      console.error('Unable to open employee edit form:', error);
      detailPanel.innerHTML = `
        <h3>Edit Employee</h3>
        <p>${escapeHtml(error.message)}</p>
      `;
    }
  });
}

function resetTablePage() {
  currentPage = 1;
  renderTable();
}

departmentFilter.addEventListener('change', resetTablePage);
sortBy.addEventListener('change', resetTablePage);
employeeSearch.addEventListener('input', resetTablePage);
previousPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderTable();
  }
});
nextPageButton.addEventListener('click', () => {
  const pageCount = Math.max(1, Math.ceil(getFilteredEmployees().length / pageSize));

  if (currentPage < pageCount) {
    currentPage += 1;
    renderTable();
  }
});
chartBreakdown.addEventListener('change', loadChartData);
addPersonnelButton.addEventListener('click', () => {
  window.location.href = 'add-personnel.html';
});
