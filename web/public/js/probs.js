function changeProbs() {
    var select = document.querySelector("#probs");
    var probsSeeding = document.querySelectorAll("#probs-seeding");
    var probsPlayoffs = document.querySelectorAll("#probs-playoffs");

    if (select.value == 'seeding') {
        probsSeeding.forEach(p => p.classList.remove("probs-hidden"));
        probsPlayoffs.forEach(p => p.classList.add("probs-hidden"));
    } else {
        probsSeeding.forEach(p => p.classList.add("probs-hidden"));
        probsPlayoffs.forEach(p => p.classList.remove("probs-hidden"));
    }
}
