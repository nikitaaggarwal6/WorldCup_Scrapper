// node WebScrappingCricInfo.js --excel=WorldCup.csv --dataDir=worldcup 
// --url=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results

let minimist = require("minimist");
let axios = require("axios");
let fs = require("fs");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let jsdom = require("jsdom");
let path = require("path");

let args = minimist(process.argv);

let dataP = axios.get(args.url);
dataP.then(function(response){
    let html = response.data;
    // console.log(html);
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    for(let i = 0; i < matchScoreDivs.length; i++) {
        // console.log(i);
        let match = {

        };

        let namePs = matchScoreDivs[i].querySelectorAll("p.name");
        match.t1 = namePs[0].textContent;
        match.t2 = namePs[1].textContent;

        let scoreSpans = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if(scoreSpans.length == 2){
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        } else if(scoreSpans.length == 1){
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        let spanResult = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = spanResult.textContent;
        // console.log(match.t1s);
        matches.push(match);
    }
    // console.log(matches);
    let matchkaJson = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchkaJson, "utf-8");
     
    let teams = [];
    for(let i = 0; i < matches.length; i++){
        addTeams(teams, matches[i].t1);
        addTeams(teams, matches[i].t2);
        // console.log(teams.length);
    }

    for(let i = 0; i < matches.length; i++){
        addMatchInfo(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        addMatchInfo(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }

    let teamskaJson = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamskaJson, "utf-8");
    // console.log(teams.length);
    prepareExcel(teams, args.excel);
    prepareFolderAndPdfs(teams, args.dataDir);

})

function prepareFolderAndPdfs(teams, dataDir){
     if(fs.existsSync(dataDir) == true) {
         fs.rmdirSync(dataDir);
     }

     fs.mkdirSync(dataDir);
     for(let i = 0; i < teams.length; i++) {
         let teamFolderName = path.join(dataDir, teams[i].name);
         fs.mkdirSync(teamFolderName);
         for(let j = 0; j < teams[i].matches.length; j++){
             let match = teams[i].matches[j];
             createMatchScoreCardPdf(teamFolderName, teams[i].name, match);
         }
     }
}

function createMatchScoreCardPdf(teamFolderName, homeTeam, match) {
    let matchFileName = path.join(teamFolderName, match.vs);

    let templateFileBytes = fs.readFileSync("template.pdf");
    let pdfkaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfkaPromise.then(function(pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText (homeTeam, {
            x: 320,
            y: 703,
            size: 9
        });
        page.drawText (match.vs, {
            x: 320,
            y: 688,
            size: 9
        });
        page.drawText (match.selfScore, {
            x: 320,
            y: 673,
            size: 9
        });
        page.drawText (match.oppScore, {
            x: 320,
            y: 658,
            size: 9
        });
        page.drawText (match.result, {
            x: 320,
            y: 645,
            size: 9
        });

        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function (changedBytes) {
            if(fs.existsSync(matchFileName + ".pdf") == true) {
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
            
        })
    })
}

function prepareExcel(teams, excelFileName){
    let wb = new excel4node.Workbook();
    // console.log(teams.length);
    for(let i = 0; i < teams.length; i++){
        // console.log(teams[i].name);
        let tsheet = wb.addWorksheet(teams[i].name);
        
        tsheet.cell(1, 1).string("VS");
        tsheet.cell(1, 2).string("SELF SCORE");
        tsheet.cell(1, 3).string("OPP SCORE");
        tsheet.cell(1, 4).string("RESULT");
        for(let j = 0; j < teams[i].matches.length; j++){
            tsheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }
    
    wb.write(excelFileName);
}

    


function addTeams(teams, teamName){
    let tidx = -1;
    for (let i = 0; i < teams.length; i++){
        if(teams[i].name == teamName){
            tidx = i;
            break;
        }
    }

    if(tidx == -1){
        teams.push({
            name: teamName,
            matches: []
        })
    }
}

function addMatchInfo(teams, homeTeam, oppTeam, homeScore, oppScore, result){
    let tidx = -1;
    for (let i = 0; i < teams.length; i++){
        if(teams[i].name == homeTeam){
            tidx = i;
            break;
        }
    }

    let team = teams[tidx];
    team.matches.push({
        vs: oppTeam,
        selfScore: homeScore,
        oppScore: oppScore,
        result: result
    })
}
