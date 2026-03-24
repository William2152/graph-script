flow "Quantum Circuit Flow":
  node start type=start label="Input State"
  node init label="Initialize"
  node gate1 label="H Gate"
  node gate2 label="CNOT Gate"
  node measure label="Measure"
  node output label="Output"
  node end type=end label="End"

  start -> init
  init -> gate1
  gate1 -> gate2
  gate2 -> measure
  measure -> output
  output -> end
