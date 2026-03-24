use chart

data:
  iteration = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  fidelity_ideal = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
  fidelity_noisy = [0.98, 0.96, 0.94, 0.92, 0.90, 0.88, 0.86, 0.84, 0.82, 0.80]

chart "Quantum Gate Fidelity":
  type = line
  x = iteration
  y = fidelity_noisy
  xlabel = "Gate Iteration"
  ylabel = "Fidelity"
  title = "Gate Fidelity Decay"
