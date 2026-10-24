try:
    grade = float(input("Enter your grade (0-10): "))
except ValueError:
    print("Invalid input")
else:
    if grade >= 6:
        print("Approved")
    else:
        print("Failed")
