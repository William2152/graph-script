use chart

algo QuantumFourier(n):
  i = 0
  while i < n:
    emit:
      step = i
      angle = 2 * 3.14159 / pow(2, i + 1)
      phase = "e^(i*" + str(angle) + ")"
    i = i + 1
  return n

data:
  result = QuantumFourier(5)

chart "QFT Phase Angles":
  type = line
  source = result
  x = step
  y = angle
  xlabel = "Step"
  ylabel = "Phase Angle"
