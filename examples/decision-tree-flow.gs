flow "Decision Tree Algorithm":
  node start type=start label="Start"
  node check1 label="Is feature > threshold?"
  node left1 label="Class A"
  node right1 label="Is feature2 > threshold2?"
  node left2 label="Class B"
  node right2 label="Class C"
  node end type=end label="End"

  start -> check1
  check1 -> left1 label="Yes"
  check1 -> right1 label="No"
  right1 -> left2 label="Yes"
  right1 -> right2 label="No"
  left1 -> end
  left2 -> end
  right2 -> end
