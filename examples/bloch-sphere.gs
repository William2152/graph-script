use chart

algo BlochSphere(theta, phi):
  x = sin(theta) * cos(phi)
  y = sin(theta) * sin(phi)
  z = cos(theta)

  emit:
    theta = theta
    phi = phi
    x = x
    y = y
    z = z

data:
  theta_val = 1.047
  phi_val = 0.785
  result = BlochSphere(theta_val, phi_val)

chart "Bloch Sphere State":
  type = scatter
  x = x
  y = z
  xlabel = "x"
  ylabel = "z"
