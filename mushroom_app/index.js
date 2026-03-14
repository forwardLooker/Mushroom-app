const Cluster = require('./Cluster.js');
const fs = require('fs');
const readline = require('readline');

const { once } = require('events');


(async function Main() {
  console.log('processInitPhaseLineByLine started');
  await processInitPhaseLineByLine();

  console.log('processIterationPhaseLineByLine started');
  await processIterationPhaseLineByLine();

  console.log('Clusterization finished');

  Cluster.clusters.forEach(cluster => {
    const clustersFromIndexes = Object.values(Cluster.transactionIndexes);
    if (!clustersFromIndexes.find(cl => cl === cluster)) {
      fs.unlink(`cluster${cluster.id}.data`, (err) => {
        if (err) throw err;
        console.log(`Successfully deleted cluster${cluster.id}.data`);
      });
    }
  })

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
      
      lineIdx++;

      if (Cluster.clusters.length === 0) {
        const cluster = new Cluster();
        cluster.addTransaction(line, lineIdx);

      } else {

        const clusterProfitsArr = Cluster.clusters.map(cluster => {
          const profit = cluster.calcProfit(line);
          return {cluster, profit}
        });

        let profitMax = 0;
        let clusterWithMaxProfit;

        clusterProfitsArr.forEach(clusterObj => {
          if (clusterObj.profit > profitMax) {
            profitMax = clusterObj.profit;
            clusterWithMaxProfit = clusterObj.cluster;
          }
        });

        const profitForNewCluster = Cluster.calcProfitForNewCluster(line);

        if (profitForNewCluster > profitMax) {
          const cluster = new Cluster();
          cluster.addTransaction(line, lineIdx);
        } else {
          clusterWithMaxProfit.addTransaction(line, lineIdx);
        }
      }

    });

    await once(rl, 'close');

    console.log('File processed. processInitPhaseLineByLine finished.');
  } catch (err) {
    console.error(err);
  }
};

// Phase 2
async function processIterationPhaseLineByLine() {
  let moved;
  let iterationCount = 0;
  do {
    moved = false;
    iterationCount++;

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
              const profit = cluster.calcProfit(line, {sourceCluster: currentCluster});
              if (profit > profitMax) {
                profitMax = profit;
                clusterWithMaxProfit = cluster;
              }
            }
          });

          // На всякий случай. Если вдруг на Итерации выгодней создать новый Кластер.
          const profitForNewCluster = Cluster.calcProfitForNewCluster(line, {sourceCluster: currentCluster});
          if ((profitForNewCluster > profitMax) && (profitForNewCluster > currentClusterProfit)) {

            currentCluster.deleteTransaction(line);  
            const cluster = new Cluster();
            cluster.addTransaction(line, lineIdx, {moved: true});
          } else {

            if (profitMax > currentClusterProfit) {
            currentCluster.deleteTransaction(line);  
            clusterWithMaxProfit.addTransaction(line, lineIdx, {moved: true});
            moved = true;
          }

          }

        });

        await once(rl, 'close');

        console.log(`Iteration №${iterationCount} File processed. processMoveLineByLine finished. moved=${moved}`);
      } catch (err) {
        console.error(err);
      }
    };

    console.log(`processMoveLineByLine started. Iteration №${iterationCount}.`);
    await processMoveLineByLine();

  } while (moved === true)
}
