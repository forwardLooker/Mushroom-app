const fs = require('fs');

module.exports = class Cluster {

  id;
  N = 0;
  static sumN = 0;
  
  S = 0;
  W = 0;
  Occ = {};
  
  static r = 2.6;
  static TRANSACTION_LENGTH = 23;

  static clusters = [];

  static transactionIndexes = {}; //lineIdx(number): cluster(Cluster)

  constructor({id}) {
    this.id = id;
  }

  static calcProfitForNewCluster(tr) {
    let sumGradientFromOtherClusters = 0;
    Cluster.clusters.forEach(cl => {
      sumGradientFromOtherClusters = sumGradientFromOtherClusters + cl.getGradient();
    });

    const profit = ((sumGradientFromOtherClusters + (Cluster.TRANSACTION_LENGTH / (Math.pow(Cluster.TRANSACTION_LENGTH, Cluster.r) )))) / Cluster.sumN;
    return profit;

  }

  calcProfit(tr, whenMoveData) {
    const profit = ((this.sumGradientFromOtherClusters(tr, whenMoveData) + this.getGradient(tr))) / Cluster.sumN;
    return profit;
  }

  sumGradientFromOtherClusters(tr, whenMoveData) {
    const otherClusters = Cluster.clusters.filter(cl => cl.id !== this.id);
    let sumGradient = 0;
    otherClusters.forEach(cl => {
      if (whenMoveData && whenMoveData.sourceCluster === cl) {
        sumGradient = sumGradient + cl.getGradient(tr, {withoutTransaction: true})
      } else {
        sumGradient = sumGradient + cl.getGradient();
      }
    });
    return sumGradient;
  };

  getGradient(tr, options = {}) {
    // For Iteration Phase
    if (options.withoutTransaction && tr) {
      const newS = this.S - Cluster.TRANSACTION_LENGTH;
      let newOcc = {...this.Occ};

      const trArr = tr.split(',');
      trArr.forEach((o, idx) => {
        if (newOcc[idx + o] > 1) {
          newOcc[idx + o] = newOcc[idx + o] - 1;
        } else {
          delete newOcc[idx + o];
        }
      });
      const newW = Object.keys(newOcc).length;

      const gradient = (newS / (Math.pow(newW, Cluster.r))) * (this.N - 1);
      return gradient;
    }
    // For Init Phase
    if (!tr) {
      const gradient = (this.S / (Math.pow(this.W, Cluster.r))) * this.N;
      return gradient;
    } else {
      const newS = this.S + Cluster.TRANSACTION_LENGTH;
      let newOcc = {...this.Occ};

      const trArr = tr.split(',');
      trArr.forEach((o, idx) => {
        if (newOcc[idx + o]) {
          newOcc[idx + o] = newOcc[idx + o] + 1;
        } else {
          newOcc[idx + o] = 1;
        }
      });
      const newW = Object.keys(newOcc).length;

      const gradient = (newS / (Math.pow(newW, Cluster.r))) * (this.N + 1);
      return gradient;
    }
  }
  
  addTransaction(tr, trIndex, options = {}) {
    try {
      if (this.N === 0) {
        fs.writeFileSync(`cluster${this.id}.data`, tr);
        this.N++;
        this.S = this.N * Cluster.TRANSACTION_LENGTH;

        const trArr = tr.split(',');
        trArr.forEach((o, idx) => {
          this.Occ[idx + o] = 1;
        });
        this.W = Object.keys(this.Occ).length;
        
        if (!options.moved) {
          Cluster.sumN++;
        }

        Cluster.transactionIndexes[trIndex] = this;
      } else {
        fs.appendFileSync(`cluster${this.id}.data`, '\r\n' + tr);
        this.N++;
        this.S = this.N * Cluster.TRANSACTION_LENGTH;

        const trArr = tr.split(',');
        trArr.forEach((o, idx) => {
          if (this.Occ[idx + o]) {
            this.Occ[idx + o] = this.Occ[idx + o] + 1;
          } else {
            this.Occ[idx + o] = 1;
          }
        });
        this.W = Object.keys(this.Occ).length;

        if (!options.moved) {
          Cluster.sumN++;
        }

        Cluster.transactionIndexes[trIndex] = this;

        if (options.moved) {
          console.log(`transaction(${tr}) moved to cluster${this.id}.data`)
        }
      }
    } catch (err) {
      console.error(err);
    }

  }

  deleteTransaction(tr) {

    let data = fs.readFileSync(`cluster${this.id}.data`, 'utf8');
    let newValue = data.replace(tr, '');

    fs.writeFileSync(`cluster${this.id}.data`, newValue);

    console.log(`transaction(${tr}) deleted from cluster${this.id}.data`);

    this.N--;
    this.S = this.N * Cluster.TRANSACTION_LENGTH;

    const trArr = tr.split(',');
    trArr.forEach((o, idx) => {
      if (this.Occ[idx + o] > 1) {
        this.Occ[idx + o] = this.Occ[idx + o] - 1;
      } else {
        delete this.Occ[idx + o];
      }
    });
    this.W = Object.keys(this.Occ).length;
  }
}