const { Char } = await import('https://cdn.jsdelivr.net/npm/chart.js');

const ctx = document.getElementById('myChart');

new Chart(ctx, {
  type: 'line',
  data: {
	labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
	datasets: [{
	  label: 'Elo Rating',
	  data: [1509, 1526, 1536, 1522, 1506, 1521, 1531, 1540],
	  borderWidth: 1
	}]
  },
  options: {
	scales: {
	  y: {
		beginAtZero: false,
		suggestedMax: 1700,
		suggestedMin: 1300
	  }
	}
  }
});
