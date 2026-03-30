from flask import Flask, render_template

app = Flask(__name__, template_folder="../templates")

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/pricing")
def pricing():
    return render_template("pricing.html")

@app.route("/book-demo")
def book_demo():
    return render_template("book_demo.html")

if __name__ == "__main__":
    app.run(debug=True)
