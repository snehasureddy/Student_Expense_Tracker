const STORAGE_KEY = "student-expense-tracker.v1";
const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const budgetForm = document.querySelector("#budget-form");
const budgetInput = document.querySelector("#monthly-budget");
const expenseForm = document.querySelector("#expense-form");
const descriptionInput = document.querySelector("#expense-description");
const categoryInput = document.querySelector("#expense-category");
const dateInput = document.querySelector("#expense-date");
const amountInput = document.querySelector("#expense-amount");
const categoryFilter = document.querySelector("#category-filter");
const expenseList = document.querySelector("#expense-list");
const budgetTotal = document.querySelector("#budget-total");
const totalSpent = document.querySelector("#total-spent");
const remainingBudget = document.querySelector("#remaining-budget");
const remainingCard = remainingBudget.closest(".summary-card");
const trackerStatus = document.querySelector("#tracker-status");
const validCategories = new Set(
	Array.from(categoryInput.options, (option) => option.value).filter(Boolean)
);

let budget = 0;
let expenses = [];

function isValidDate(value) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function loadSavedState() {
	try {
		const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
		if (!savedState || typeof savedState !== "object") return;

		if (Number.isFinite(savedState.budget) && savedState.budget >= 0) {
			budget = savedState.budget;
		}

		if (Array.isArray(savedState.expenses)) {
			expenses = savedState.expenses.filter((expense) =>
				expense &&
				typeof expense.id === "string" &&
				typeof expense.description === "string" &&
				expense.description.trim() &&
				validCategories.has(expense.category) &&
				isValidDate(expense.date) &&
				Number.isFinite(expense.amount) &&
				expense.amount > 0
			);
		}
	} catch {
		trackerStatus.textContent = "Saved data could not be read. You can continue with a new tracker.";
	}
}

function saveState() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ budget, expenses }));
		return true;
	} catch {
		trackerStatus.textContent = "Changes could not be saved in this browser.";
		return false;
	}
}

function formatCurrency(amount) {
	return currencyFormatter.format(amount);
}

function renderSummary() {
	const spent = expenses.reduce((total, expense) => total + expense.amount, 0);
	const remaining = budget - spent;

	budgetTotal.textContent = formatCurrency(budget);
	totalSpent.textContent = formatCurrency(spent);
	remainingBudget.textContent = formatCurrency(remaining);
	remainingCard.classList.toggle("is-over-budget", remaining < 0);
	budgetInput.value = budget ? String(budget) : "";
}

function makeCell(text, className = "") {
	const cell = document.createElement("td");
	cell.textContent = text;
	if (className) cell.className = className;
	return cell;
}

function renderExpenses() {
	const selectedCategory = categoryFilter.value;
	const visibleExpenses = expenses
		.filter((expense) => selectedCategory === "all" || expense.category === selectedCategory)
		.sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id));
	const rows = document.createDocumentFragment();

	if (visibleExpenses.length === 0) {
		const row = document.createElement("tr");
		row.className = "empty-state";
		const message = selectedCategory === "all"
			? "No expenses yet. Add one above to get started."
			: `No ${selectedCategory.toLowerCase()} expenses found.`;
		const cell = makeCell(message);
		cell.colSpan = 5;
		row.append(cell);
		rows.append(row);
	} else {
		for (const expense of visibleExpenses) {
			const row = document.createElement("tr");
			const date = new Date(`${expense.date}T00:00:00`);
			row.append(
				makeCell(date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })),
				makeCell(expense.description),
				makeCell(expense.category),
				makeCell(formatCurrency(expense.amount), "amount-cell")
			);

			const actions = document.createElement("td");
			const deleteButton = document.createElement("button");
			deleteButton.type = "button";
			deleteButton.className = "delete-expense-button";
			deleteButton.dataset.expenseId = expense.id;
			deleteButton.setAttribute("aria-label", `Delete expense: ${expense.description}`);
			deleteButton.textContent = "Delete";
			actions.append(deleteButton);
			row.append(actions);
			rows.append(row);
		}
	}

	expenseList.replaceChildren(rows);
}

function render() {
	renderSummary();
	renderExpenses();
}

function announceChange(message) {
	trackerStatus.textContent = message;
}

function makeExpenseId() {
	return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

budgetForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!budgetForm.reportValidity()) return;

	const nextBudget = Number(budgetInput.value);
	if (!Number.isFinite(nextBudget) || nextBudget < 0) {
		budgetInput.setCustomValidity("Enter a valid budget of zero or more.");
		budgetInput.reportValidity();
		budgetInput.setCustomValidity("");
		return;
	}

	budget = nextBudget;
	renderSummary();
	const saved = saveState();
	if (saved) announceChange("Monthly budget updated.");
});

expenseForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!expenseForm.reportValidity()) return;

	const description = descriptionInput.value.trim();
	const amount = Number(amountInput.value);
	const category = categoryInput.value;
	const date = dateInput.value;

	if (!description) {
		descriptionInput.setCustomValidity("Enter a description for this expense.");
		descriptionInput.reportValidity();
		descriptionInput.setCustomValidity("");
		return;
	}
	if (!validCategories.has(category)) {
		categoryInput.setCustomValidity("Choose a category from the list.");
		categoryInput.reportValidity();
		categoryInput.setCustomValidity("");
		return;
	}
	if (!Number.isFinite(amount) || amount <= 0) {
		amountInput.setCustomValidity("Enter an amount greater than zero.");
		amountInput.reportValidity();
		amountInput.setCustomValidity("");
		return;
	}
	if (!isValidDate(date)) {
		dateInput.setCustomValidity("Choose a valid expense date.");
		dateInput.reportValidity();
		dateInput.setCustomValidity("");
		return;
	}

	expenses.push({ id: makeExpenseId(), description, category, date, amount });
	const saved = saveState();
	render();
	expenseForm.reset();
	dateInput.value = getLocalDate();
	if (saved) announceChange(`Added expense: ${description}.`);
});

expenseList.addEventListener("click", (event) => {
	const deleteButton = event.target.closest("button[data-expense-id]");
	if (!deleteButton) return;

	const expense = expenses.find((item) => item.id === deleteButton.dataset.expenseId);
	if (!expense) return;

	expenses = expenses.filter((item) => item.id !== expense.id);
	const saved = saveState();
	render();
	if (saved) announceChange(`Deleted expense: ${expense.description}.`);
});

function getLocalDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

categoryFilter.addEventListener("change", renderExpenses);
descriptionInput.addEventListener("input", () => descriptionInput.setCustomValidity(""));
categoryInput.addEventListener("change", () => categoryInput.setCustomValidity(""));
amountInput.addEventListener("input", () => amountInput.setCustomValidity(""));
dateInput.addEventListener("change", () => dateInput.setCustomValidity(""));

dateInput.value = getLocalDate();
loadSavedState();
render();
