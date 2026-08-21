const departmentSelect = document.getElementById("department");
const positionSelect = document.getElementById("position");
const employmentStatusSelect = document.getElementById("employmentStatus");
const contactNumberInput = document.querySelector("[name=contactNumber]");
const employeeIdInput = document.querySelector("[name=employeeId]");
const personnelForm = document.getElementById("personnelForm");
const saveButton = personnelForm.querySelector("button[type=submit]");

function populateSelect(select, options) {
    options.forEach(({ id, name }) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = name;
        select.appendChild(option);
    });
}

async function loadPersonnelOptions() {
    try {
        const response = await fetch("/api/personnel/options");

        if (!response.ok) {
            throw new Error(`Options request failed with status ${response.status}`);
        }

        const { options } = await response.json();
        populateSelect(departmentSelect, options.departments);
        populateSelect(positionSelect, options.positions);
        populateSelect(employmentStatusSelect, options.statuses);
    } catch (error) {
        console.error("Unable to load personnel options:", error);
    }
}

loadPersonnelOptions();

contactNumberInput.addEventListener("input", () => {
    contactNumberInput.value = contactNumberInput.value.replace(/\D/g, "");
});

employeeIdInput.addEventListener("input", () => {
    employeeIdInput.value = employeeIdInput.value.replace(/\D/g, "").slice(0, 6);
});

personnelForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!personnelForm.reportValidity()) {
        return;
    }

    const emailInput = personnelForm.querySelector("input[name='email']");
    const emailValue = emailInput.value.trim();
    const validEmailPattern = /^[^@\s]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.[a-z\.-]+$/i;

    if (!validEmailPattern.test(emailValue)) {
        emailInput.setCustomValidity("Please enter a valid email address with a supported domain like Gmail, Yahoo, Outlook, or Hotmail.");
        emailInput.reportValidity();
        emailInput.focus();
        return;
    }

    emailInput.setCustomValidity("");

    const confirmed = window.confirm(
        "Are all entered data accurate? Click OK to add this personnel record to the Personnel list."
    );

    if (!confirmed) {
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Adding...";

    try {
        const response = await fetch("/api/personnel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(new FormData(personnelForm)))
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to add personnel.");
        }

        window.alert("Personnel was added to the Personnel list.");
        window.location.href = "index.html";
    } catch (error) {
        console.error("Add personnel error:", error);
        window.alert(error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Personnel";
    }
});
