const Cluster = require('./Cluster.js');
const fs = require('fs');
const readline = require('readline');

const { once } = require('events');

// const rl = readline.createInterface({
//   input: fs.createReadStream('agaricus-lepiota.data'),
//   crlfDelay: Infinity // Treats '\r\n' as a single newline
// });

(async function Main() {
  await processInitPhaseLineByLine();
  await processIterationPhaseLineByLine();
  console.log('Clusterization finished');
})()

// Phase 1
async function processInitPhaseLineByLine() {
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream('agaricus-lepiota.data'),
      crlfDelay: Infinity,
    });

    let lineIdx = 0;

    rl.on('line', (line) => {
      
      // console.log(`Line from file: ${line}`);
      lineIdx++;

      if (Cluster.clusters.length === 0) {
        const cluster = new Cluster({id: 1});
        cluster.addTransaction(line, lineIdx);
        Cluster.clusters.push(cluster);


      } else {
        const clusterProfitsArr = Cluster.clusters.map(cluster => {
          const profit = cluster.calcProfit(line);
          return {cluster, profit}
        });
        let profitMax = 0;
        let clusterWithMaxProfit;

        clusterProfitsArr.forEach(clObj => {
          if (clObj.profit > profitMax) {
            profitMax = clObj.profit;
            clusterWithMaxProfit = clObj.cluster;
          }
        });

        const profitForNewCluster = Cluster.calcProfitForNewCluster(line);

        // console.log('profitForNewCluster', profitForNewCluster);
        // console.log('profitMax', profitMax);

        if (profitForNewCluster > profitMax) {
          const cluster = new Cluster({id: Cluster.clusters.length + 1});
          cluster.addTransaction(line, lineIdx);
          Cluster.clusters.push(cluster);
        } else {
          clusterWithMaxProfit.addTransaction(line, lineIdx);
        }
      }

    });

    await once(rl, 'close');

    console.log('File processed. Init Phase.');
  } catch (err) {
    console.error(err);
  }
};

// Phase 2
async function processIterationPhaseLineByLine() {
  let moved;
  let iteration = 0;
  do {
    moved = false;
    iteration++;

    let lineIdx = 0;

    async function processMoveLineByLine() {
      try {
        const rl = readline.createInterface({
          input: fs.createReadStream('agaricus-lepiota.data'),
          crlfDelay: Infinity,
        });


        rl.on('line', (line) => {
          lineIdx++;

          const currentCluster = Cluster.transactionIndexes[lineIdx];
          const currentClusterProfit = currentCluster.calcProfit();

          let profitMax = 0;
          let clusterWithMaxProfit;

          Cluster.clusters.forEach(cluster => {
            if (cluster !== currentCluster) {
              const profit = cluster.calcProfit(line);
              if (profit > profitMax) {
                profitMax = profit;
                clusterWithMaxProfit = cluster;
              }
            }
          });

          if (profitMax > currentClusterProfit) {
            currentCluster.deleteTransaction(line);  
            clusterWithMaxProfit.addTransaction(line, lineIdx, {moved: true});
            moved = true;
          }

        });

        await once(rl, 'close');

        console.log(`File processed. Iteration Phase. Iteration №${iteration}`);
      } catch (err) {
        console.error(err);
      }
    };

    await processMoveLineByLine();

  } while (moved === true)
}
