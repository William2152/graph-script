flow "Graph Traversal":
  node start type=start label="Start"
  node queue label="Add to Queue"
  node check label="Queue Empty?"
  node process label="Process Node"
  node neighbors label="Add Neighbors"
  node end type=end label="End"

  start -> queue
  queue -> check
  check -> process label="No"
  check -> end label="Yes"
  process -> neighbors
  neighbors -> check
