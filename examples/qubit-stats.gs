use chart

data:
  labels = ["Q1", "Q2", "Q3", "Q4", "Q5"]
  probabilities = [0.3, 0.15, 0.25, 0.2, 0.1]
  measurements = [3, 1, 2, 2, 1]

chart "Measurement Probabilities":
  type = pie
  source = probabilities

chart "Measurement Counts":
  type = bar
  source = measurements
  xlabel = "Qubit"
  ylabel = "Count"
