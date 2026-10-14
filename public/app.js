document.addEventListener('DOMContentLoaded', () => {
  const expenseForm = document.getElementById('expenseForm');
  const titleInput = document.getElementById('title');
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');
  const expenseDateInput = document.getElementById('expenseDate');
  const submitBtn = document.getElementById('submitBtn');
  const statusMessage = document.getElementById('statusMessage');
  const refreshBtn = document.getElementById('refreshBtn');
  const expensesContainer = document.getElementById('expensesContainer');

  // Default date to today
  const today = new Date().toISOString().split('T')[0];
  expenseDateInput.value = today;

  // Fetch and display expenses
  async function loadExpenses() {
    try {
      expensesContainer.innerHTML = '<p class="empty-state">Loading expenses...</p>';
      const res = await fetch('/api/expenses');
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        renderExpenses(data.data);
      } else {
        expensesContainer.innerHTML = `<p class="empty-state">${data.message || 'Unable to load expenses.'}</p>`;
      }
    } catch (err) {
      console.error(err);
      expensesContainer.innerHTML = '<p class="empty-state">Could not connect to backend server.</p>';
    }
  }

  // Render expenses in DOM
  function renderExpenses(expenses) {
    if (expenses.length === 0) {
      expensesContainer.innerHTML = '<p class="empty-state">No expenses logged yet. Save your first expense above!</p>';
      return;
    }

    expensesContainer.innerHTML = expenses
      .map(item => {
        const dateFormatted = item.expense_date
          ? new Date(item.expense_date).toISOString().split('T')[0]
          : 'N/A';
        const amountFormatted = parseFloat(item.amount).toFixed(2);

        return `
          <div class="expense-item">
            <div class="expense-info">
              <h3>${escapeHtml(item.title)}</h3>
              <div class="expense-meta">
                <span>📁 ${escapeHtml(item.category || 'General')}</span>
                <span>📅 ${dateFormatted}</span>
              </div>
            </div>
            <div class="expense-amount">
              -$${amountFormatted}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Handle form submission (Save an expense)
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categoryInput.value;
    const expense_date = expenseDateInput.value || today;

    if (!title) {
      showStatus('Please enter an expense title.', 'error');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      showStatus('Please enter a valid amount greater than 0.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    hideStatus();

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          amount,
          category,
          expense_date
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showStatus('Expense saved successfully!', 'success');
        expenseForm.reset();
        expenseDateInput.value = today;
        loadExpenses();
      } else {
        showStatus(result.message || 'Failed to save expense.', 'error');
      }
    } catch (err) {
      console.error(err);
      showStatus('Network error: Unable to reach the server.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>💾 Save Expense</span>';
    }
  });

  // Manual refresh button
  refreshBtn.addEventListener('click', () => {
    loadExpenses();
  });

  // Helper functions
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
  }

  function hideStatus() {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  loadExpenses();
});
