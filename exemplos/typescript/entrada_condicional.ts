// Reads a line from the terminal (prompt() asks in the IDE console)
const answer: string | null = prompt("Enter your grade (0-10): ")
const grade: number = Number(answer)

if (Number.isNaN(grade)) {
  console.log("Invalid input")
} else if (grade >= 6) {
  console.log("Approved")
} else {
  console.log("Failed")
}
