function sortTeamNames() {
    var table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("teams-table");
    switching = true;
    
    while (switching) {
        switching = false;
        rows = table.rows;
        
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[1].getElementsByTagName("A")[0];
            y = rows[i + 1].getElementsByTagName("TD")[1].getElementsByTagName("A")[0];
            
            if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                shouldSwitch = true;
                break;
            }
        }

        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}

function sortElos() {
    var table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("teams-table");
    switching = true;
    
    while (switching) {
        switching = false;
        rows = table.rows;
        
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[4];
            y = rows[i + 1].getElementsByTagName("TD")[4];
            
            if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                shouldSwitch = true;
                break;
            }
        }

        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}

function sortRecords() {
    var table, rows, switching, i, x, y, xNums, yNums, xWins, yWins, xLosses, yLosses, xPct, yPct, shouldSwitch;
    table = document.getElementById("teams-table");
    switching = true;
    
    while (switching) {
        switching = false;
        rows = table.rows;
        
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[5];
            y = rows[i + 1].getElementsByTagName("TD")[5];
            xNums = x.innerHTML.toLowerCase().split('-');
            yNums = y.innerHTML.toLowerCase().split('-');
            xWins = xNums[0];
            yWins = yNums[0];
            xLosses = xNums[1];
            yLosses = yNums[1];
            xPct = xWins / (xWins + xLosses);
            yPct = yWins / (yWins + yLosses);

            if (isNaN(xPct)) {
                xPct = 0.01;
            }

            if (isNaN(yPct)) {
                yPct = 0.01;
            }
            
            if (xPct < yPct) {
                shouldSwitch = true;
                break;
            }
        }

        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}

function sortTable(n) {
    var table, rows, switching, x, y, xChance, yChance;
    table = document.getElementById("teams-table");
    switching = true;

    while (switching) {
        switching = false;
        rows = table.rows;

        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            xChance = Number(x.innerHTML.replace('%', '').replace('<', '').replace('>', ''));
            yChance = Number(y.innerHTML.replace('%', '').replace('<', '').replace('>', ''));

            console.log(xChance);
            console.log(yChance);

            if (xChance < yChance) {
                shouldSwitch = true;
                break;
            }
        }

        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}

/*function sortDivisions() {
    var table, rows, switching, x, y;
    table = document.getElementById("teams-table");
    switching = true;

    while (switching) {
        switching = false;
        rows = table.rows;

        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[3].innerHTML;
            y = rows[i + 1].getElementsByTagName("TD")[3].innerHTML;

            if (x < y) {
                shouldSwitch = true;
                break;
            }
        }

        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}*/
