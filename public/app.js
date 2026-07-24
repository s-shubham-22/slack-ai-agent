document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('analyzeForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    
    const resultsPanel = document.getElementById('resultsPanel');
    const scoreBadge = document.getElementById('scoreBadge');
    const scoreValue = document.getElementById('scoreValue');
    const insightsList = document.getElementById('insightsList');
    const recommendationsList = document.getElementById('recommendationsList');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset state
        errorMessage.classList.add('hidden');
        resultsPanel.classList.add('hidden');
        submitBtn.disabled = true;
        btnText.textContent = 'Analyzing...';
        loadingSpinner.classList.remove('hidden');

        // Gather data
        const formData = new FormData(form);
        const memberInfo = {
            name: formData.get('name'),
            email: formData.get('email'),
            title: formData.get('title')
        };

        try {
            const response = await fetch('/test/analyze-member', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ memberInfo })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to analyze member');
            }

            displayResults(data.analysis);
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Analyze Member';
            loadingSpinner.classList.add('hidden');
        }
    });

    function displayResults(analysis) {
        // Handle Score
        const score = analysis.fitScore;
        scoreValue.textContent = score;
        
        scoreValue.style.color = 'inherit'; // default
        if (score >= 80) {
            scoreValue.style.color = 'var(--success)';
        } else if (score >= 60) {
            scoreValue.style.color = 'var(--warning-high)';
        } else if (score >= 40) {
            scoreValue.style.color = 'var(--warning)';
        } else {
            scoreValue.style.color = 'var(--danger)';
        }

        // Handle Insights
        insightsList.innerHTML = '';
        analysis.insights.forEach(insight => {
            const li = document.createElement('li');
            li.textContent = insight;
            insightsList.appendChild(li);
        });

        // Handle Recommendations
        recommendationsList.innerHTML = '';
        analysis.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recommendationsList.appendChild(li);
        });

        // Show panel
        resultsPanel.classList.remove('hidden');
    }
});
