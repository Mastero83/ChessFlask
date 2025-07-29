var aiMoveInProgress = false;
var cheatDepth = 10;
var evalHistory = [];

// === ELO Mapping ===
function depthToElo(depth) {
    // Approximate mapping for simple engines
    var map = {1: 800, 2: 1100, 3: 1400, 4: 1700, 5: 2000};
    return map[depth] || (800 + depth * 400);
}

function updateEloDisplay() {
    var slider = document.getElementById("engineDepthSlider");
    var depth = parseInt(slider.value, 10);
    var elo = depthToElo(depth);
    document.getElementById('eloDisplay').innerText = 'ELO: ' + elo;
}

function updateEngineDepthValue() {
    var slider = document.getElementById("engineDepthSlider");
    var value = slider.value;
    document.getElementById('engineDepthValue').innerText = value;
    // Directly update the stockfishDepth span
    var stockfishDepthSpan = document.getElementById('stockfishDepth');
    if (stockfishDepthSpan) {
        stockfishDepthSpan.innerText = value;
    }
}

function getEngineSettings() {
    return {
        UCI_LimitStrength: "true",
        UCI_Elo: parseInt(document.getElementById('engineEloSlider').value, 10)
    };
}

function updateEngineEloValue() {
    var slider = document.getElementById('engineEloSlider');
    document.getElementById('engineEloValue').innerText = slider.value;
}

document.addEventListener('DOMContentLoaded', function() {
    var eloSlider = document.getElementById('engineEloSlider');
    if (eloSlider) {
        eloSlider.addEventListener('input', updateEngineEloValue);
        updateEngineEloValue();
    }
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.addEventListener('input', function() {
        setVolume(this.value);
    });
    var skillSlider = document.getElementById('engineSkillLevel');
    if (skillSlider) {
        skillSlider.addEventListener('input', updateEngineSkillLevelValue);
        updateEngineSkillLevelValue();
    }
});



var setPGN = function() {
  var table = document.getElementById("pgn");
  var pgn = game.pgn().split(" ");
  var move = pgn[pgn.length - 1];
}

var moveEvalCache = {};

function getFenBeforeMove(moveIndex) {
    // Returns the FEN before the move at moveIndex (0-based ply)
    var tempGame = new Chess();
    var history = game.history({ verbose: true });
    for (var i = 0; i < moveIndex; i++) {
        tempGame.move(history[i]);
    }
    return tempGame.fen();
}

async function getEvalForFen(fen) {
    if (moveEvalCache[fen] !== undefined) return moveEvalCache[fen];
    return new Promise(function(resolve) {
        $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
            var val = 0;
            if (typeof score === 'string' && score.indexOf('mate') !== -1) {
                val = score.startsWith('mate -') ? -10000 : 10000;
            } else if (!isNaN(parseFloat(score))) {
                val = parseFloat(score);
            } else {
                val = null; // error fallback
            }
            moveEvalCache[fen] = val;
            resolve(val);
        }).fail(function() {
            moveEvalCache[fen] = null;
            resolve(null);
        });
    });
}

async function getCplForMove(moveIndex) {
    // CPL = |eval_after - eval_before|, always positive
    var fenBefore = getFenBeforeMove(moveIndex);
    var fenAfter = getFenBeforeMove(moveIndex + 1);
    var evalBefore = await getEvalForFen(fenBefore);
    var evalAfter = await getEvalForFen(fenAfter);
    return Math.abs(evalAfter - evalBefore);
}

// Add loading indicator for CPL
async function createTableWithCPL() {
    const pgn = game.pgn().replace(/(\[.*?\]\s*)+/g, '').trim();
    const moves = pgn.split(/\s+/);
    const history = game.history({ verbose: true });
    const data = [];
    for (let i = 0; i < moves.length; i += 3) {
        data.push({
            moveNumber: moves[i] || '',
            whiteMove: moves[i + 1] || '',
            blackMove: moves[i + 2] || ''
        });
    }

    // Build FENs for before and after each ply
    let tempGame = new Chess();
    const fens = [tempGame.fen()];
    for (let i = 0; i < history.length; i++) {
        tempGame.move(history[i]);
        fens.push(tempGame.fen());
    }

    // Fetch evals for all FENs with debug output
    const evals = await Promise.all(fens.map(fen =>
        fetch(`/eval/${encodeURIComponent(fen)}/`)
            .then(r => r.text())
            .then(score => {
                console.log('FEN:', fen, 'Eval:', score); // Debug output
                if (score.includes('mate')) return score.startsWith('mate -') ? -10000 : 10000;
                const val = parseFloat(score);
                return isNaN(val) ? null : val;
            })
            .catch((e) => { console.log('Eval fetch error:', e); return null; })
    ));

    // Compute CPLs
    const cplWhite = [], cplBlack = [];
    for (let i = 1; i < evals.length; i += 2) {
        cplWhite.push(evals[i] != null && evals[i - 1] != null ? Math.abs(evals[i] - evals[i - 1]) : '-');
        cplBlack.push(evals[i + 1] != null && evals[i] != null ? Math.abs(evals[i + 1] - evals[i]) : '-');
    }

    // Render table
    $('#pgn tr').not(':first').remove();
    let html = '';
    for (let i = 0; i < data.length; i++) {
        html += `<tr>
            <td>${data[i].moveNumber}</td>
            <td>${data[i].whiteMove}</td>
            <td>${cplWhite[i] !== undefined ? `<span style="color:#1976d2;font-weight:bold;">${cplWhite[i]}</span>` : ''}</td>
            <td>${data[i].blackMove}</td>
            <td>${cplBlack[i] !== undefined ? `<span style="color:#d32f2f;font-weight:bold;">${cplBlack[i]}</span>` : ''}</td>
        </tr>`;
    }
    $('#pgn tr').first().after(html);
}

// Ensure table updates on move, new game, take back, and toggle
function updateMoveTable() {
    moveEvalCache = {}; // Clear cache to avoid stale evals
    createTable();
}

// Patch updateStatus to update move table
var oldUpdateStatus = updateStatus;
updateStatus = function() {
    oldUpdateStatus.apply(this, arguments);
    updateMoveTable();
};

// Patch takeBack and newGame to update move table
var oldTakeBack = takeBack;
takeBack = function() {
    oldTakeBack.apply(this, arguments);
    updateMoveTable();
};
var oldNewGame = newGame;
newGame = function() {
    oldNewGame.apply(this, arguments);
    updateMoveTable();
};

document.addEventListener('DOMContentLoaded', function() {
    var toggle = document.getElementById('toggleMoveEval');
    if (toggle) {
        toggle.addEventListener('change', function() {
            updateMoveTable();
        });
    }
    // Initial table render
    updateMoveTable();
});

var createTable = function() {
    if (document.getElementById('toggleMoveEval')?.checked) {
        createTableWithCPL();
        return;
    }
    var pgn = game.pgn();
    // Remove header lines
    pgn = pgn.replace(/(\[.*?\]\s*)+/g, '').trim();
    var moves = pgn.split(/\s+/);
    var data = [];
    for (i = 0; i < moves.length; i += 3) {
        var index = i / 3;
        data[index] = {};
        for (j = 0; j < 3; j++) {
            var label = "";
            if (j === 0) {
                label = "moveNumber";
            } else if (j === 1) {
                label = "whiteMove";
            } else if (j === 2) {
                label = "blackMove";
            }
            if (moves.length > i + j) {
                data[index][label] = moves[i + j];
            } else {
                data[index][label] = "";
            }
        }
    }
    $('#pgn tr').not(':first').remove();
    var html = '';
    for (var i = 0; i < data.length; i++) {
        html += '<tr><td>' + data[i].moveNumber + '</td><td>'
        + data[i].whiteMove + '</td><td></td><td>'
        + data[i].blackMove + '</td><td></td></tr>';
    }
    $('#pgn tr').first().after(html);
}

var updateScroll = function() {
    $('#moveTable').scrollTop($('#moveTable')[0].scrollHeight);
}

var setStatus = function(status) {
  document.getElementById("status").innerHTML = status;
}

var takeBack = function() {
    var history = game.history();
    if (history.length === 0) {
        // No moves to undo
        return;
    } else if (history.length === 1) {
        // Only one move to undo
    game.undo();
    } else {
        // Always undo two moves (AI + player)
        game.undo();
        game.undo();
    }
    safeBoardPosition(game.fen());
    updateStatus();
}

function getUrlParam(name) {
    var results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return results ? decodeURIComponent(results[1]) : null;
}

var initialPlayerColor = getUrlParam('color');
var playerColor = typeof initialPlayerColor !== 'undefined' ? initialPlayerColor : (getUrlParam('color') || 'white');
var playMode = getUrlParam('mode') || 'cpu'; // 'cpu' or 'analysis'

var newGame = function() {
    game.reset();
    board.orientation(playerColor);
    if (playMode === 'analysis') {
        safeBoardPosition(game.fen());
        updateStatus();
        return;
    }
    if (playerColor === 'black') {
        updateStatus();
        setTimeout(function() {
            if (playMode !== 'analysis') {
                getResponseMove();
                setTimeout(function() {
                    safeBoardPosition(game.fen());
                    updateStatus();
                }, 400);
            }
        }, 300);
    } else {
        board.orientation('white');
        safeBoardPosition(game.fen());
        updateStatus();
    }
}

var getCapturedPieces = function() {
    var history = game.history({ verbose: true });
    for (var i = 0; i < history.length; i++) {
        if ("captured" in history[i]) {
            console.log(history[i]["captured"]);
        }
    }
}

var getLastCapture = function() {
    var history = game.history({ verbose: true });
    var index = history.length - 1;

    if (history[index] != undefined && "captured" in history[index]) {
        console.log(history[index]["captured"]);
    }
}

// === Sound Effects ===
var moveSound = new Audio('static/sounds/move.mp3');
var captureSound = new Audio('static/sounds/capture.mp3');
moveSound.volume = 0.5;
captureSound.volume = 0.5;
var soundMuted = false;

function playMoveSound(isCapture) {
    if (soundMuted) return;
    if (isCapture) {
        captureSound.currentTime = 0;
        captureSound.play();
    } else {
        moveSound.currentTime = 0;
        moveSound.play();
    }
}

function setVolume(vol) {
    moveSound.volume = vol;
    captureSound.volume = vol;
}

function toggleMute() {
    soundMuted = !soundMuted;
    document.getElementById('muteBtn').innerText = soundMuted ? 'Unmute' : 'Mute';
}

// === ELO Mapping ===
function depthToElo(depth) {
    // Approximate mapping for simple engines
    var map = {1: 800, 2: 1100, 3: 1400, 4: 1700, 5: 2000};
    return map[depth] || (800 + depth * 400);
}

function updateEloDisplay() {
    var slider = document.getElementById("engineDepthSlider");
    var depth = parseInt(slider.value, 10);
    var elo = depthToElo(depth);
    document.getElementById('eloDisplay').innerText = 'ELO: ' + elo;
}

function updateEngineDepthValue() {
    var slider = document.getElementById("engineDepthSlider");
    document.getElementById('engineDepthValue').innerText = slider.value;
}

document.addEventListener('DOMContentLoaded', function() {
    var slider = document.getElementById('engineDepthSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            updateEngineDepthValue();
        });
        updateEngineDepthValue();
    }
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.addEventListener('input', function() {
        setVolume(this.value);
    });
});



// Function to update the cheats moves list (to be called after backend support is added)
function updateCheatsMovesList(moves) {
    var $list = $('#cheatsMovesList');
    $list.empty();
    if (!moves || moves.length === 0) {
        $list.append('<div class="cheat-move">(No moves yet)</div>');
        return;
    }
    // Sort moves so best move is always on top
    var isWhite = game.turn() === 'w';
    moves.sort(function(a, b) {
        return isWhite ? b.score - a.score : a.score - b.score;
    });
    moves.forEach(function(move, idx) {
        var evalDisplay = '';
        if (typeof move.score === 'number') {
            if (Math.abs(move.score) >= 10000) {
                // Mate in N
                var mateN = Math.abs(move.score) === 100000 ? '' : Math.abs(move.score);
                evalDisplay = (move.score > 0 ? '#+' : '#-') + mateN;
            } else {
                var cp = move.score / 100.0;
                evalDisplay = (cp > 0 ? '+' : '') + cp.toFixed(2);
            }
        }
        $list.append('<div class="cheat-move">' +
            '<span style="min-width:60px;display:inline-block;font-weight:bold;">' + move.san + '</span>' +
            '<span class="cheat-move-score" style="color:' + (move.score > 0 ? '#388e3c' : (move.score < 0 ? '#d32f2f' : '#888')) + '; font-weight:600; margin-left:12px;">' + evalDisplay + '</span>' +
        '</div>');
    });
}

function fetchAndShowCheatMoves() {
    var depth = cheatDepth;
    var fen = game.fen();
    $.get('/cheat_moves/' + depth + '/' + encodeURIComponent(fen) + '/', function(moves) {
        updateCheatsMovesList(moves);
    });
}

function updateNavBoard() {
    var history = game.history();
    var tempGame = new Chess();
    for (var i = 0; i < (navIndex !== null ? navIndex : history.length); i++) {
        tempGame.move(history[i]);
    }
    safeBoardPosition(tempGame.fen());
}

// --- Metadata Panel Logic ---
function parsePgnHeaders(pgn) {
    // Extract headers from PGN string
    var headers = {};
    var headerRegex = /\[(\w+)[ \t]+"([^"]*)"\]/g;
    var match;
    while ((match = headerRegex.exec(pgn)) !== null) {
        headers[match[1]] = match[2];
    }
    return headers;
}

function renderMetaPanel(headers) {
    var fields = [
        { key: 'Event', label: 'Event' },
        { key: 'Site', label: 'Site' },
        { key: 'Date', label: 'Date' },
        { key: 'Round', label: 'Round' },
        { key: 'White', label: 'White' },
        { key: 'Black', label: 'Black' },
        { key: 'Result', label: 'Result' },
        { key: 'WhiteElo', label: 'White Elo' },
        { key: 'BlackElo', label: 'Black Elo' },
        { key: 'ECO', label: 'ECO' }
    ];
    var html = '<table class="table table-condensed" style="margin-bottom:0;">';
    fields.forEach(function(f) {
        if (headers[f.key]) {
            html += '<tr><th style="width:90px;">' + f.label + '</th><td>' + headers[f.key] + '</td></tr>';
        }
    });
    html += '</table>';
    $('#metaPanelBody').html(html);
}

function updateMetaPanelFromGame() {
    // Get headers from current game PGN
    var pgn = game.pgn();
    var headers = parsePgnHeaders(pgn);
    renderMetaPanel(headers);
}

// Toggle meta panel
$(document).on('click', '#metaPanelToggleBtn', function() {
    $('#metaPanel').slideToggle(180);
});

// Show meta panel by default if desired
// $('#metaPanel').show();

// When loading a new PGN (import or from opening selection), update meta panel
var oldUpdateStatusMeta = updateStatus;
updateStatus = function() {
    oldUpdateStatusMeta();
    updateMetaPanelFromGame();
};

// When importing PGN, also update meta panel
$('#importPgnPanelBtn').on('click', function() {
    setTimeout(updateMetaPanelFromGame, 100);
});

// When loading imported PGN from localStorage (on /play), update meta panel
if (window.location.pathname === '/play' && localStorage.getItem('importedPGN')) {
    setTimeout(updateMetaPanelFromGame, 200);
}

var showGameOverOverlay = function(winner, moves, reason) {
    // Set winner and move info
    var title = '';
    if (winner) {
        title = winner + ' wins!';
    } else {
        title = 'Draw!';
    }
    if (reason) {
        title += ' (' + reason + ')';
    }
    $('#gameOverTitle').text(title);
    $('#gameOverMoves').text('Total moves played: ' + moves);
    // Analyze game with Stockfish
    var pgn = game.pgn();
    var depth = 5;
    $('#gameSummaryTableWrapper').html('<div style="margin:24px 0; color:#888;">Analyzing game with Stockfish...</div>');
    $.ajax({
        url: '/analyze_game/',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ pgn: pgn, depth: depth }),
        success: function(res) {
            var evals = res.evals;
            var summary = classifyMovesWithEvalsByColor(evals);
            var moveTypeEmojis = {
                'Brilliant': '🤩 (!!)',
                'Best': '👍 (!)',
                'Excellent': '👏 (!)',
                'Good': '🙂 (!?)',
                'Inaccuracy': '😕 (?)',
                'Mistake': '😬 (?)',
                'Blunder': '😱 (??)'
            };
            // Calculate accuracy per color
            var accuracy = calculateAccuracyByColor(evals); // This uses the same evals as move classification
            var html = '';
            html += '<div style="display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom:10px;">';
            html += '<div style="background:linear-gradient(120deg,#fff,#e3e3e3);border-radius:10px;box-shadow:0 1px 6px #1976d233;padding:8px 12px;display:flex;flex-direction:column;align-items:center;min-width:70px;">';
            html += '<span style="font-size:1.1em; color:#1976d2; font-weight:700; line-height:1;">&#9812;</span>';
            html += '<span style="font-size:1em; font-weight:600; color:#1976d2;">' + accuracy.white + '%</span>';
            html += '<span style="font-size:0.85em; color:#555; font-weight:400; margin-top:2px;">White</span>';
            html += '</div>';
            html += '<div style="background:linear-gradient(120deg,#222,#444);border-radius:10px;box-shadow:0 1px 6px #0003;padding:8px 12px;display:flex;flex-direction:column;align-items:center;min-width:70px;">';
            html += '<span style="font-size:1.1em; color:#ffd600; font-weight:700; line-height:1;">&#9818;</span>';
            html += '<span style="font-size:1em; font-weight:600; color:#ffd600;">' + accuracy.black + '%</span>';
            html += '<span style="font-size:0.85em; color:#eee; font-weight:400; margin-top:2px;">Black</span>';
            html += '</div>';
            html += '</div>';
            html += '<table class="table table-bordered" style="margin-top:4px; font-size:0.92em; border-radius:6px; overflow:hidden; background:#fafbfc;">';
            html += '<thead><tr style="background:#f0f2f5;"><th style="font-weight:600;">Move Type</th><th style="color:#1976d2; font-weight:600;">White</th><th style="color:#388e3c; font-weight:600;">Black</th></tr></thead><tbody>';
            var moveTypes = [ 'Brilliant', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder' ];
            for (var i = 0; i < moveTypes.length; i++) {
                var key = moveTypes[i];
                html += '<tr>';
                html += '<td style="padding:2px 6px;">' + key + '</td>';
                html += '<td style="padding:2px 6px; text-align:center;">' + (summary.white[key] || 0) + '</td>';
                html += '<td style="padding:2px 6px; text-align:center;">' + (summary.black[key] || 0) + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table>';
            $('#gameSummaryTableWrapper').html(html);
        },
        error: function() {
            $('#gameSummaryTableWrapper').html('<div style="color:#d32f2f;">Analysis failed. Please try again.</div>');
        }
    });
    $('#gameOverOverlay').fadeIn(400);
    startFireworks();
};

var hideGameOverOverlay = function() {
    $('#gameOverOverlay').fadeOut(200);
    stopFireworks();
};

// Fireworks animation (simple)
var fireworksInterval;
function startFireworks() {
    var canvas = document.getElementById('fireworksCanvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var particles = [];
    function randomColor() {
        var colors = ['#ff5252','#ffd600','#69f0ae','#40c4ff','#b388ff','#ff4081'];
        return colors[Math.floor(Math.random()*colors.length)];
    }
    function createParticle() {
        var x = Math.random()*canvas.width;
        var y = Math.random()*canvas.height*0.6;
        var r = 2+Math.random()*3;
        var color = randomColor();
        var dx = (Math.random()-0.5)*6;
        var dy = (Math.random()-1.2)*6;
        var life = 60+Math.random()*30;
        particles.push({x,y,r,color,dx,dy,life});
    }
    fireworksInterval = setInterval(function() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if (particles.length<80) for(var i=0;i<8;i++) createParticle();
        for(var i=0;i<particles.length;i++) {
            var p=particles[i];
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
            ctx.fillStyle=p.color;
            ctx.globalAlpha = Math.max(0,p.life/90);
            ctx.fill();
            p.x+=p.dx; p.y+=p.dy; p.dy+=0.08; p.life--;
        }
        particles=particles.filter(p=>p.life>0);
        ctx.globalAlpha=1;
    },30);
}
function stopFireworks() {
    clearInterval(fireworksInterval);
    var canvas = document.getElementById('fireworksCanvas');
    if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
    }
}

// Fetch and display Stockfish evaluation for the current position
function fetchAndDisplayEval() {
    var fen = game.fen();
    $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
        // If you have an evaluation bar, update it here
        // Example: updateEvalBar(score);
        // Or display the score somewhere in the UI
        console.log('Stockfish eval:', score);
    });
}

// === Evaluation Bar Logic ===
function setEvalBarVisibility(visible) {
    var bar = document.getElementById('evalBarContainer');
    if (bar) bar.style.display = visible ? 'flex' : 'none';
}

function updateEvalBar(score) {
    lastEvalScore = score;
    // Parse score: handle mate and centipawn
    let evalCp = 0;
    let display = '';
    if (typeof score === 'string' && score.indexOf('mate') !== -1) {
        // e.g. 'mate 3' or 'mate -2'
        let mateVal = parseInt(score.replace('mate', '').trim(), 10);
        evalCp = mateVal > 0 ? 1000 : -1000;
        display = mateVal > 0 ? `#${mateVal}` : `#-${Math.abs(mateVal)}`;
    } else {
        evalCp = Math.max(-1000, Math.min(1000, parseFloat(score)));
        display = (evalCp / 100).toFixed(2);
    }
    // Convert to percent: +1000 = 100% (white), 0 = 50%, -1000 = 0% (black)
    let percent = 50 + (evalCp / 20);
    percent = Math.max(0, Math.min(100, percent));
    let whiteHeight = percent;
    let blackHeight = 100 - percent;
    let whiteDiv = document.getElementById('evalBarWhite');
    let blackDiv = document.getElementById('evalBarBlack');
    // Fix: when playing as white, white is at the bottom (whiteDiv), black at the top (blackDiv)
    //      when playing as black, white is at the top (whiteDiv), black at the bottom (blackDiv)
    if (typeof playerColor !== 'undefined' && playerColor === 'white') {
        whiteDiv.style.height = whiteHeight + '%';
        blackDiv.style.height = blackHeight + '%';
        whiteDiv.style.order = 2;
        blackDiv.style.order = 1;
    } else {
        whiteDiv.style.height = whiteHeight + '%';
        blackDiv.style.height = blackHeight + '%';
        whiteDiv.style.order = 1;
        blackDiv.style.order = 2;
    }
    // Show score label
    let scoreDiv = document.getElementById('evalBarScore');
    if (scoreDiv) {
        scoreDiv.innerText = display;
    }
}

// Real-time polling for Stockfish evaluation
let evalBarPollingInterval = null;
function startEvalBarPolling() {
    stopEvalBarPolling();
    function poll() {
        if (!document.getElementById('toggleEvalBar')?.checked || game.game_over()) {
            stopEvalBarPolling();
            return;
        }
        var fen = game.fen();
        $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
            updateEvalBar(score);
        });
        evalBarPollingInterval = setTimeout(poll, 500);
    }
    poll();
}
function stopEvalBarPolling() {
    if (evalBarPollingInterval) {
        clearTimeout(evalBarPollingInterval);
        evalBarPollingInterval = null;
    }
}
// Hook polling to settings and game state
function setupEvalBarIntegration() {
    var evalCheckbox = document.getElementById('toggleEvalBar');
    if (evalCheckbox) {
        evalCheckbox.addEventListener('change', function() {
            setEvalBarVisibility(this.checked);
            if (this.checked) {
                updateEvalBar(0); // Reset
                startEvalBarPolling();
            } else {
                stopEvalBarPolling();
            }
        });
        setEvalBarVisibility(evalCheckbox.checked);
        if (evalCheckbox.checked) startEvalBarPolling();
    }
    // On every move, restart polling if enabled
    var oldUpdateStatus = updateStatus;
    updateStatus = function() {
        oldUpdateStatus.apply(this, arguments);
        if (document.getElementById('toggleEvalBar')?.checked && !game.game_over()) {
            startEvalBarPolling();
        } else {
            stopEvalBarPolling();
        }
    };
    // On board resize, match bar height
    function syncEvalBarHeight() {
        var boardEl = document.getElementById('board');
        var barEl = document.getElementById('evalBar');
        var barContainer = document.getElementById('evalBarContainer');
        if (boardEl && barEl && barContainer) {
            var h = boardEl.offsetHeight;
            barEl.style.height = h + 'px';
            barEl.style.maxHeight = h + 'px';
            barContainer.style.height = h + 'px';
            barContainer.style.maxHeight = h + 'px';
        }
    }
    window.addEventListener('resize', syncEvalBarHeight);
    setTimeout(syncEvalBarHeight, 100);
    var boardSizeSlider = document.getElementById('boardSizeSlider');
    if (boardSizeSlider) {
        boardSizeSlider.addEventListener('input', function() {
            setTimeout(syncEvalBarHeight, 200);
        });
    }
}
document.addEventListener('DOMContentLoaded', setupEvalBarIntegration);

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Fetch eval and update bar
const fetchEvalAndUpdateBar = debounce(function() {
    if (!document.getElementById('toggleEvalBar')?.checked) return;
    var fen = game.fen();
    $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
        updateEvalBar(score);
    });
}, 250);

// Hook into move events and settings
function setupEvalBarIntegration() {
    var evalCheckbox = document.getElementById('toggleEvalBar');
    if (evalCheckbox) {
        evalCheckbox.addEventListener('change', function() {
            setEvalBarVisibility(this.checked);
            if (this.checked) fetchEvalAndUpdateBar();
        });
        setEvalBarVisibility(evalCheckbox.checked);
    }
    // On every move, update the bar if enabled
    var oldUpdateStatus = updateStatus;
    updateStatus = function() {
        oldUpdateStatus.apply(this, arguments);
        if (document.getElementById('toggleEvalBar')?.checked) {
            fetchEvalAndUpdateBar();
        }
    };
    // On board resize, match bar height
    function syncEvalBarHeight() {
        var boardEl = document.getElementById('board');
        var barEl = document.getElementById('evalBar');
        var barContainer = document.getElementById('evalBarContainer');
        if (boardEl && barEl && barContainer) {
            var h = boardEl.offsetHeight;
            barEl.style.height = h + 'px';
            barEl.style.maxHeight = h + 'px';
            barContainer.style.height = h + 'px';
            barContainer.style.maxHeight = h + 'px';
        }
    }
    window.addEventListener('resize', syncEvalBarHeight);
    setTimeout(syncEvalBarHeight, 100);
    // Also sync after board size slider changes
    var boardSizeSlider = document.getElementById('boardSizeSlider');
    if (boardSizeSlider) {
        boardSizeSlider.addEventListener('input', function() {
            setTimeout(syncEvalBarHeight, 200);
        });
    }
}
document.addEventListener('DOMContentLoaded', setupEvalBarIntegration);

// --- Socket.IO real-time Stockfish debug integration ---
var socket = null;
var stockfishDebugStarted = false;
$(document).on('click', '#debugToggleBtn', function() {
    $('#debugPanel').slideToggle(180);
    if ($('#debugPanel').is(':visible') && !stockfishDebugStarted) {
        if (!socket) {
            socket = io();
        }
        $('#debugOutput').val('');
        socket.emit('start_stockfish_debug');
        stockfishDebugStarted = true;
        socket.on('debug_output', function(line) {
            appendDebugOutput(line);
        });
    }
});

// Function to append text to the debug output textarea
function appendDebugOutput(text) {
    var $output = $('#debugOutput');
    $output.val($output.val() + text + '\n');
    $output.scrollTop($output[0].scrollHeight);
}
// Example usage: appendDebugOutput('Stockfish started...');



// Simple heuristic for move classification (placeholder)
function analyzeGameSummary() {
    var history = game.history({ verbose: true });
    var summary = { 'Brilliant': 0, 'Best': 0, 'Excellent': 0, 'Good': 0, 'Inaccuracy': 0, 'Mistake': 0, 'Blunder': 0 };
    // Placeholder: classify all as Good
    for (var i = 0; i < history.length; i++) {
        summary['Good']++;
    }
    return summary;
}

$(document).on('click', '#closeGameOverBtn', function() {
    $('#gameOverOverlay').fadeOut(200);
    stopFireworks();
});

// Classify moves based on evaluation change, split by color
function classifyMovesWithEvalsByColor(evals, moveDetails) {
    // moveDetails: array of move objects (optional, for future tactical detection)
    var types = [ 'Brilliant', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder', 'Forced Move' ];
    var summary = { white: {}, black: {} };
    types.forEach(function(t) { summary.white[t] = 0; summary.black[t] = 0; });
    if (!evals || evals.length < 2) return summary;
    for (var i = 1; i < evals.length; i++) {
        var diff = evals[i] - evals[i-1];
        var absDiff = Math.abs(diff);
        var color = (i % 2 === 1) ? 'white' : 'black';
        var type = 'Good';
        // Forced Move: if only one move avoids a drop > 300cp (placeholder, needs engine multi-move info)
        if (moveDetails && moveDetails[i-1] && moveDetails[i-1].forced) {
            type = 'Forced Move';
        } else if (absDiff > 300) {
            type = 'Blunder';
        } else if (absDiff > 150) {
            type = 'Mistake';
        } else if (absDiff > 50) {
            type = 'Inaccuracy';
        } else if (absDiff > 20) {
            type = 'Good';
        } else if (absDiff > 10) {
            type = 'Excellent';
        } else {
            type = 'Best';
        }
        // Placeholder for Brilliant: if move is a sacrifice or only move, and absDiff < 50
        if (moveDetails && moveDetails[i-1] && moveDetails[i-1].brilliant) {
            type = 'Brilliant';
        }
        summary[color][type]++;
    }
    return summary;
}

// Calculate accuracy per color (simple chess.com-like logic)
function calculateAccuracyByColor(evals) {
    if (!evals || evals.length < 2) return { white: 0, black: 0 };
    var total = { white: 0, black: 0 };
    var max = { white: 0, black: 0 };
    for (var i = 1; i < evals.length; i++) {
        var diff = Math.abs(evals[i] - evals[i-1]);
        var color = (i % 2 === 1) ? 'white' : 'black';
        max[color] += 100;
        // The closer the move is to 0 eval change, the higher the accuracy
        var acc = Math.max(0, 100 - Math.min(diff / 10, 100));
        total[color] += acc;
    }
    return {
        white: max.white ? Math.round(total.white / (max.white/100)) : 0,
        black: max.black ? Math.round(total.black / (max.black/100)) : 0
    };
}

$(document).on('click', '#giveUpBtn', function() {
    if (game.game_over()) return;
    var winner = game.turn() === 'w' ? 'Black' : 'White';
    var moves = game.history().length;
    showGameOverOverlay(winner, moves, 'Resignation');
});

$(document).on('click', '#drawBtn', function() {
    if (game.game_over()) return;
    var moves = game.history().length;
    showGameOverOverlay(null, moves, 'Draw agreed');
});

// After board is created (in DOMContentLoaded or wherever board is initialized)
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the chess board only if #board exists
    if ($('#board').length > 0) {
        board = ChessBoard('board', cfg);
    }

    // Board size slider functionality
    var $slider = $('#boardSizeSlider');
    var $sizeValue = $('#boardSizeValue');
    function setBoardSize(size) {
        $('#board').css({ width: size + 'px', height: size + 'px' });
        safeBoardResize();
        $sizeValue.text(size + 'px');
    }
    $slider.on('input change', function() {
        setBoardSize(this.value);
    });
    // Set initial size
    setBoardSize($slider.val());

    // Settings panel expand/collapse (now only one icon at the top)
    $('#settingsToggleBtn').on('click', function() {
        $('#settingsPanel').slideToggle(180);
    });
    // Accordion logic for settings
    $('#settingsAccordion').on('show.bs.collapse', function (e) {
        $(e.target).parent().siblings().find('.panel-collapse').collapse('hide');
    });

    // Cheats panel expand/collapse
    $('#cheatsToggleBtn').on('click', function() {
        $('#cheatsPanel').slideToggle(180, function() {
            if ($('#cheatsPanel').is(':visible')) {
                fetchAndShowCheatMoves();
            }
        });
    });
    // Fetch cheats after each move if panel is open
    var oldUpdateStatusCheat = updateStatus;
    updateStatus = function() {
        oldUpdateStatusCheat();
        if ($('#cheatsPanel').is(':visible')) {
            fetchAndShowCheatMoves();
        }
    };

    // AI Assistant panel toggle
    $('#aiAssistantToggleBtn').on('click', function() {
        $('#aiAssistantPanel').slideToggle(180);
    });

    // Show PGN panel on download button click
    $('#downloadPgnBtn').on('click', function() {
        $('#pgnText').val(game.pgn());
        $('#pgnPanelWrapper').css('display', 'flex');
    });
    // Close PGN panel
    $('#closePgnPanelBtn').on('click', function() {
        $('#pgnPanelWrapper').hide();
    });
    // Download PGN from panel
    $('#downloadPgnPanelBtn').on('click', function() {
        var pgn = exportAnnotationsToPGN(game.pgn());
        $('#pgnText').val(pgn);
        var blob = new Blob([pgn], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'game.pgn';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    });

    // Move navigation controls
    $('#moveNavFirst').on('click', function() {
        navIndex = 0;
        updateNavBoard();
        updateMoveNavNumber();
    });
    $('#moveNavBack').on('click', function() {
        var history = game.history();
        if (navIndex === null) navIndex = history.length;
        if (navIndex > 0) {
            navIndex--;
            updateNavBoard();
            updateMoveNavNumber();
        }
    });
    $('#moveNavForward').on('click', function() {
        var history = game.history();
        if (navIndex === null) navIndex = history.length;
        if (navIndex < history.length) {
            navIndex++;
            updateNavBoard();
            updateMoveNavNumber();
        }
    });
    $('#moveNavLast').on('click', function() {
        navIndex = game.history().length;
        updateNavBoard();
        updateMoveNavNumber();
    });
    $('#moveNavNumber').on('change', function() {
        var val = parseInt($(this).val(), 10);
        var max = game.history().length;
        if (isNaN(val) || val < 0) val = 0;
        if (val > max) val = max;
        navIndex = val;
        updateNavBoard();
        updateMoveNavNumber();
    });
    function updateMoveNavNumber() {
        var history = game.history();
        var idx = navIndex === null ? history.length : navIndex;
        $('#moveNavNumber').val(idx);
        $('#moveNavTotal').text('/ ' + history.length);
    }
    // Call updateMoveNavNumber whenever board is updated
    var oldUpdateNavBoard = updateNavBoard;
    updateNavBoard = function() {
        oldUpdateNavBoard();
        updateMoveNavNumber();
    };

    // Import PGN from panel
    $('#importPgnPanelBtn').on('click', function() {
        var pgn = $('#pgnText').val();
        var newGame = new Chess();
        if (newGame.load_pgn(pgn)) {
            game = newGame;
            safeBoardPosition(game.fen());
            updateStatus();
            $('#pgnPanelWrapper').hide();
        } else {
            alert('Invalid PGN. Please check your input.');
        }
    });

    // Update PGN textarea whenever the game changes
    var oldUpdateStatusPgn = updateStatus;
    updateStatus = function() {
        oldUpdateStatusPgn();
        if ($('#pgnPanelWrapper').is(':visible')) {
            $('#pgnText').val(game.pgn());
        }
    };

    // Cheat move hover preview
    $(document).on('mouseenter', '.cheat-move', function() {
        var moveSan = $(this).find('span').first().text();
        var tempGame = new Chess();
        var history = game.history();
        for (var i = 0; i < history.length; i++) {
            tempGame.move(history[i]);
        }
        var move = tempGame.move(moveSan, { sloppy: true });
        if (move) {
            cheatPreviewBackup = board.fen();
            safeBoardPosition(tempGame.fen());
            // Highlight from/to squares
            highlightSquares(move.from, move.to);
        }
    });
    $(document).on('mouseleave', '.cheat-move', function() {
        if (cheatPreviewBackup) {
            safeBoardPosition(cheatPreviewBackup);
            removeHighlights();
            cheatPreviewBackup = null;
        }
    });

    // Load imported PGN if present
    if (window.location.pathname === '/play' && localStorage.getItem('importedPGN')) {
        var imported = localStorage.getItem('importedPGN');
        if (imported) {
            var newGame = new Chess();
            if (newGame.load_pgn(imported)) {
                game = newGame;
                safeBoardPosition(game.fen());
                updateStatus();
                // Update player info cards
                var headers = parsePgnHeaders(imported);
                updatePlayerInfoCardsFromHeaders(headers);
            }
            localStorage.removeItem('importedPGN');
        }
    }

    // Auto-expand metaPanel accordion if importedPGN is set
    if (window.location.pathname === '/play' && localStorage.getItem('importedPGN')) {
        setTimeout(function() {
            $('#metaPanel').collapse('show');
        }, 200);
    }

    // Attach click-to-move handler using chessboard.js API
    // This is now handled by attachClickToMoveHandler

    // Set board orientation on load
    board.orientation(playerColor);
    // If playing as black, trigger AI move immediately (only in cpu mode)
    if (playMode !== 'analysis' && playerColor === 'black' && game.history().length === 0) {
        blockUserInput(true);
        setTimeout(function() {
            getResponseMove();
            setTimeout(function() {
                safeBoardPosition(game.fen());
                updateStatus();
                blockUserInput(false);
            }, 400);
        }, 300);
    }

    // Enable clicking a cheat move to play it
    $(document).on('click', '.cheat-move', function() {
        var moveSan = $(this).find('span').first().text();
        var move = game.move(moveSan, { sloppy: true });
        if (move) {
            playMoveSound(!!move.captured);
            safeBoardPosition(game.fen());
            updateStatus();
            // If it's now AI's turn, trigger AI move
            if ((playerColor === 'white' && game.turn() === 'b') || (playerColor === 'black' && game.turn() === 'w')) {
                setTimeout(function() { getResponseMove(); }, 300);
            }
        }
    });

    $(document).on('input change', '#cheatDepthSlider', function() {
        cheatDepth = parseInt($(this).val(), 10);
        $('#cheatDepthValue').text(cheatDepth);
        fetchAndShowCheatMoves();
    });

    // After board is created (in DOMContentLoaded or wherever board is initialized)
    if (typeof board !== 'undefined') {
        updateEvalBar(0);
    }
});

// At the end of newGame function
var originalNewGame = newGame;
newGame = function() {
    originalNewGame.apply(this, arguments);
    updateEvalBar(0);
};

function attachClickToMoveHandler() {
    // Remove any previous handlers to avoid duplicates
    $('#board').off('mousedown.chessClickMove');
    // Attach click-to-move handler using chessboard.js API
    $('#board').on('mousedown.chessClickMove', '.square-55d63', function(e) {
        // Only handle left click
        if (e.which !== 1) return;
        var square = $(this).attr('data-square');
        var piece = game.get(square) ? (game.get(square).color[0] + game.get(square).type.toUpperCase()) : null;
        console.log('[Click-to-move] Clicked square:', square, 'piece:', piece);
        onSquareClick(square, piece);
    });
}

// Patch: always re-attach click-to-move after board redraws
function safeBoardPosition(fen) {
    board.position(fen);
    attachClickToMoveHandler();
}
function safeBoardResize() {
    board.resize();
    attachClickToMoveHandler();
}

let playMovesInterval = null;
let isPlayingMoves = false;

function setMoveNavDisabled(disabled) {
    const btns = [
        '#moveNavFirst', '#moveNavBack', '#moveNavForward', '#moveNavLast', '#moveNavNumber', '#downloadPgnBtn', '#playMovesBtn'
    ];
    btns.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.disabled = disabled;
    });
}

function stopMovePlayback() {
    if (playMovesInterval) clearInterval(playMovesInterval);
    playMovesInterval = null;
    isPlayingMoves = false;
    setMoveNavDisabled(false);
    const playBtn = document.getElementById('playMovesBtn');
    if (playBtn) playBtn.classList.remove('playing');
}

function playMoves() {
    if (isPlayingMoves) {
        stopMovePlayback();
        return;
    }
    isPlayingMoves = true;
    setMoveNavDisabled(true);
    const playBtn = document.getElementById('playMovesBtn');
    if (playBtn) playBtn.classList.add('playing');
    // Start from current move
    let current = parseInt(document.getElementById('moveNavNumber').value, 10) || 0;
    const total = parseInt(document.getElementById('moveNavTotal').textContent.replace('/','').trim(), 10) || 0;
    function step() {
        if (!isPlayingMoves) return;
        if (current >= total) {
            stopMovePlayback();
            return;
        }
        document.getElementById('moveNavNumber').value = current + 1;
        // Trigger move navigation (simulate user input)
        const event = new Event('change', { bubbles: true });
        document.getElementById('moveNavNumber').dispatchEvent(event);
        current++;
        if (current < total) {
            playMovesInterval = setTimeout(step, 1200);
        } else {
            stopMovePlayback();
        }
    }
    step();
}

document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    const playBtn = document.getElementById('playMovesBtn');
    if (playBtn) {
        playBtn.addEventListener('click', playMoves);
    }
    // Stop playback if user interacts with nav
    ['moveNavFirst','moveNavBack','moveNavForward','moveNavLast','moveNavNumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', stopMovePlayback);
            el.addEventListener('change', stopMovePlayback);
        }
    });
});

// Add CSS for play button animation
const style = document.createElement('style');
style.innerHTML = `
.move-nav-btn.playing {
  background: linear-gradient(90deg, #43a047 60%, #81c784 100%) !important;
  color: #fff !important;
  animation: playPulse 1.2s infinite alternate;
}
@keyframes playPulse {
  0% { box-shadow: 0 0 0 0 #43a04733; }
  100% { box-shadow: 0 0 12px 6px #43a04733; }
}`;
document.head.appendChild(style);

// === Player Info Card Update ===
function updatePlayerInfoCardsFromHeaders(headers) {
    // Update White player (user)
    var whiteName = headers['White'] || 'White';
    var whiteDivs = document.querySelectorAll('#userInfoCard div');
    if (whiteDivs.length >= 2) {
        whiteDivs[0].querySelector('img').src =
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(whiteName) + '&background=1976d2&color=fff&size=48';
        whiteDivs[1].children[0].textContent = whiteName;
    }
    // Update Black player (opponent)
    var blackName = headers['Black'] || 'Black';
    var oppNameDiv = document.getElementById('opponentName');
    if (oppNameDiv) oppNameDiv.textContent = blackName;
    // Optionally update avatar for black (if not Stockfish)
    var oppImg = document.querySelector('#opponentInfoCard img');
    if (oppImg && blackName !== 'Stockfish' && blackName !== 'AI' && blackName !== 'Engine') {
        oppImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(blackName) + '&background=444444&color=fff&size=38';
    } else if (oppImg) {
        oppImg.src = 'https://img.icons8.com/ios-filled/50/ffb300/robot-2.png';
    }
}

// === Move Annotations Logic ===
var moveAnnotations = {};

function getCurrentMoveIndex() {
    // Returns the current move index (0-based ply)
    var idx = navIndex === null ? game.history().length : navIndex;
    return idx;
}

function loadAnnotationsFromPGN(pgn) {
    // Parse PGN comments for each move
    moveAnnotations = {};
    var lines = pgn.split('\n');
    var moves = [];
    var comments = [];
    var moveIdx = 0;
    var inComment = false;
    var commentBuffer = '';
    var tokens = pgn.replace(/\r?\n/g, ' ').split(/\s+/);
    tokens.forEach(function(token) {
        if (token.startsWith('{')) {
            inComment = true;
            commentBuffer = token.slice(1);
            if (token.endsWith('}')) {
                inComment = false;
                commentBuffer = commentBuffer.slice(0, -1);
                comments.push({ idx: moveIdx, text: commentBuffer.trim() });
                commentBuffer = '';
            }
        } else if (inComment) {
            if (token.endsWith('}')) {
                commentBuffer += ' ' + token.slice(0, -1);
                inComment = false;
                comments.push({ idx: moveIdx, text: commentBuffer.trim() });
                commentBuffer = '';
            } else {
                commentBuffer += ' ' + token;
            }
        } else if (/^([a-h][1-8]|O-O|O-O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|[a-h][1-8]=[QRBN])([+#])?$/.test(token)) {
            // Looks like a move
            moveIdx++;
        }
    });
    comments.forEach(function(c) {
        moveAnnotations[c.idx] = c.text;
    });
}

function exportAnnotationsToPGN(pgn) {
    // Insert comments into PGN for each move
    var tokens = pgn.split(/(\s+)/);
    var moveIdx = 0;
    var result = '';
    tokens.forEach(function(token) {
        result += token;
        if (/^([a-h][1-8]|O-O|O-O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|[a-h][1-8]=[QRBN])([+#])?$/.test(token)) {
            moveIdx++;
            if (moveAnnotations[moveIdx]) {
                result += ' {' + moveAnnotations[moveIdx].replace(/}/g, '') + '}';
            }
        }
    });
    return result;
}

// Open/close modal logic
$(document).on('click', '#annotationsBtn', function() {
    var idx = getCurrentMoveIndex();
    $('#annotationsText').val(moveAnnotations[idx] || '');
    $('#annotationsPanelWrapper').css('display', 'flex');
});
$(document).on('click', '#closeAnnotationsPanelBtn', function() {
    $('#annotationsPanelWrapper').hide();
});
$(document).on('click', '#saveAnnotationsBtn', function() {
    var idx = getCurrentMoveIndex();
    var text = $('#annotationsText').val();
    if (text.trim()) {
        moveAnnotations[idx] = text.trim();
    } else {
        delete moveAnnotations[idx];
    }
    $('#annotationsPanelWrapper').hide();
});

// Integrate with PGN import/export
function renderAnnotationsPanel() {
    var $panel = $('#annotationsPanelBody');
    $panel.empty();
    var hasAny = false;
    // If initialMoveAnnotations is present, show all keys
    var annotationsSource = (window.initialMoveAnnotations && Object.keys(window.initialMoveAnnotations).length > 0) ? window.initialMoveAnnotations : moveAnnotations;
    var keys = Object.keys(annotationsSource).map(function(k) { return parseInt(k, 10); }).sort(function(a, b) { return a - b; });
    for (var i = 0; i < keys.length; i++) {
        var idx = keys[i];
        var ann = annotationsSource[idx];
        if (ann && ann.trim()) {
            hasAny = true;
            var moveNum = Math.floor((idx-1)/2) + 1;
            var color = ((idx-1) % 2 === 0) ? 'White' : 'Black';
            $panel.append('<div style="margin-bottom:10px;"><b>Move ' + moveNum + ' (' + color + '):</b><br><span style="color:#8e24aa;">' + ann.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') + '</span></div>');
        }
    }
    if (!hasAny) {
        $panel.append('<div style="color:#888;">No annotations for this game.</div>');
    }
    // Debug JSON area
    var $debug = $('<div style="margin-top:18px;"></div>');
    var jsonStr = '';
    if (window.loadedGameJson && Object.keys(window.loadedGameJson).length > 0) {
        jsonStr = JSON.stringify(window.loadedGameJson, null, 2);
    } else {
        jsonStr = 'No loaded game JSON.';
    }
    $debug.append('<label style="font-weight:600;color:#1976d2;">Debug: Full Game JSON</label>');
    $debug.append('<textarea readonly style="width:100%;min-height:120px;font-size:0.98em;background:#f5f7fa;border-radius:8px;border:1px solid #bbb;padding:8px;resize:vertical;">' + jsonStr + '</textarea>');
    $('#gameJsonDebugWrapper').remove();
    $panel.append($debug.attr('id','gameJsonDebugWrapper'));
    // Add DB annotations fetch button and box
    if ($('#gameJsonDebugWrapper').length) {
        if (!$('#refreshDbAnnotationsBtn').length) {
            $('#gameJsonDebugWrapper').append(
                '<button id="refreshDbAnnotationsBtn" style="margin-top:10px;">Refresh Annotations from DB</button>' +
                '<textarea id="moveAnnotationsFromDbBox" readonly style="width:100%;min-height:60px;margin-top:6px;background:#f5f7fa;border-radius:8px;border:1px solid #bbb;padding:8px;"></textarea>'
            );
            $('#refreshDbAnnotationsBtn').on('click', function() {
                var gameId = window.currentGameId;
                if (!gameId) {
                    $('#moveAnnotationsFromDbBox').val('No game ID available.');
                    return;
                }
                $.getJSON('/api/game_json/' + encodeURIComponent(gameId), function(data) {
                    if (data && data.game && Array.isArray(data.game.move_annotations)) {
                        var anns = data.game.move_annotations.map((ann, idx) =>
                            ann ? `Move ${idx+1}: ${ann}` : null
                        ).filter(Boolean).join('\n');
                        $('#moveAnnotationsFromDbBox').val(anns || 'No move annotations in DB.');
                    } else {
                        $('#moveAnnotationsFromDbBox').val('No move annotations found.');
                    }
                });
            });
        }
    }
}
// Update annotations panel when game or annotations change
var oldUpdateStatusAnnotations = updateStatus;
updateStatus = function() {
    oldUpdateStatusAnnotations();
    renderAnnotationsPanel();
};
// Also update on PGN import
$('#importPgnPanelBtn').on('click', function() {
    setTimeout(renderAnnotationsPanel, 150);
});
// On page load, load annotations from PGN
$(function() {
    function getGameIdFromUrl() {
        var match = window.location.pathname.match(/play_game\/(.+)$/);
        return match ? match[1] : null;
    }
    function fetchGameJson(gameId, cb) {
        $.getJSON('/api/game_json/' + encodeURIComponent(gameId), function(data) {
            if (data && data.game) {
                window.loadedGameJson = data.game;
                cb(data.game);
            } else {
                cb(null);
            }
        }).fail(function() { cb(null); });
    }
    if (window.loadedGameJson && Object.keys(window.loadedGameJson).length > 0) {
        // ... existing code for loading JSON ...
        var g = window.loadedGameJson;
        var newGame = new Chess();
        if (g.headers) {
            Object.keys(g.headers).forEach(function(key) {
                newGame.header(key, g.headers[key]);
            });
        }
        if (g.moves && Array.isArray(g.moves)) {
            g.moves.forEach(function(move) {
                if (move) newGame.move(move, { sloppy: true });
            });
        }
        game = newGame;
        safeBoardPosition(game.fen());
        moveAnnotations = {};
        if (g.move_annotations && Array.isArray(g.move_annotations)) {
            g.move_annotations.forEach(function(ann, idx) {
                if (ann && ann.trim()) moveAnnotations[idx+1] = ann;
            });
        }
        renderAnnotationsPanel();
        updateStatus();
    } else if (window.initialMoveAnnotations && Object.keys(window.initialMoveAnnotations).length > 0) {
        moveAnnotations = window.initialMoveAnnotations;
        renderAnnotationsPanel();
    } else {
        // Try to fetch game JSON for annotation box if game_id is in URL
        var gameId = getGameIdFromUrl();
        if (gameId) {
            fetchGameJson(gameId, function(gameJson) {
                if (gameJson) {
                    window.loadedGameJson = gameJson;
                    renderAnnotationsPanel();
                } else {
                    loadAnnotationsFromPGN(game.pgn());
                    renderAnnotationsPanel();
                }
            });
        } else {
            loadAnnotationsFromPGN(game.pgn());
            renderAnnotationsPanel();
        }
    }
});

// Add annotation popup for per-move annotation
if (!document.getElementById('moveAnnotationPopup')) {
    var popupHtml = '<div id="moveAnnotationPopup" class="annotation-popup" style="display:none;">'
        + '<button class="close-btn" onclick="$(\'#moveAnnotationPopup\').hide();">&times;</button>'
        + '<div style="font-weight:700;font-size:1.2em;color:#8e24aa;margin-bottom:10px;">Move Annotation</div>'
        + '<textarea id="moveAnnotationText"></textarea>'
        + '<div style="text-align:right;">'
        + '<button class="save-btn" id="saveMoveAnnotationBtn">Save</button>'
        + '<button class="btn btn-default" onclick="$(\'#moveAnnotationPopup\').hide();">Cancel</button>'
        + '</div></div>';
    $(document.body).append(popupHtml);
}
$(document).off('click', '.annotation-icon').on('click', '.annotation-icon', function() {
    var ply = $(this).data('ply');
    var ann = moveAnnotations[ply] || '';
    $('#moveAnnotationText').val(ann);
    $('#moveAnnotationPopup').show();
    $('#saveMoveAnnotationBtn').data('ply', ply);
});
$('#saveMoveAnnotationBtn').off('click').on('click', function() {
    var ply = $(this).data('ply');
    var text = $('#moveAnnotationText').val();
    if (text.trim()) {
        moveAnnotations[ply] = text.trim();
    } else {
        delete moveAnnotations[ply];
    }
    $('#moveAnnotationPopup').hide();
});

// Keyboard navigation for moves
$(document).on('keydown', function(e) {
    if ($(e.target).is('input, textarea')) return; // Don't interfere with typing
    if (e.key === 'ArrowLeft') {
        $('#moveNavBack').click();
        e.preventDefault();
    } else if (e.key === 'ArrowRight') {
        $('#moveNavForward').click();
        e.preventDefault();
    }
});
