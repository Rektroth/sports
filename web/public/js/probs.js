function changeProbs() {
    var select = document.querySelector("#probs");
    var probsMinSeeding = document.querySelectorAll("#probs-min-seeding");
    var probsIndSeeding = document.querySelectorAll("#probs-ind-seeding");
    var probsPlayoffs = document.querySelectorAll("#probs-playoffs");

    switch (select.value) {
        case "min-seeding":
            probsMinSeeding.forEach(p => p.classList.remove("probs-hidden"));
            probsIndSeeding.forEach(p => p.classList.add("probs-hidden"));
            probsPlayoffs.forEach(p => p.classList.add("probs-hidden"));
            break;
        case "ind-seeding":
            probsMinSeeding.forEach(p => p.classList.add("probs-hidden"));
            probsIndSeeding.forEach(p => p.classList.remove("probs-hidden"));
            probsPlayoffs.forEach(p => p.classList.add("probs-hidden"));
            break;
        default:
            probsMinSeeding.forEach(p => p.classList.add("probs-hidden"));
            probsIndSeeding.forEach(p => p.classList.add("probs-hidden"));
            probsPlayoffs.forEach(p => p.classList.remove("probs-hidden"));
            break;
    }
}
