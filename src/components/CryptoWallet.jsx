import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check, Clock, CheckCircle, XCircle, TrendingUp, Info, MessageSquare, Briefcase, BarChartBig, Layers, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CryptoWallet = ({ user, updateUser, onDataUpdate }) => {
  const [isDepositOpen, setDepositOpen] = useState(false);
  const [isWithdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [feeAddresses, setFeeAddresses] = useState({});
  const [activeDepositTab, setActiveDepositTab] = useState('BTC');
  const [activeWithdrawTab, setActiveWithdrawTab] = useState('BTC');
  const [depositAmount, setDepositAmount] = useState('');
  const [displayedBenefits, setDisplayedBenefits] = useState(user.benefits || 0);
  
  const PROFIT_DURATION = 4 * 60 * 60 * 1000;
  const WITHDRAWAL_TAX_PERCENT = 0.03;

  const hasInvestmentHistory = useMemo(() => {
    const allInvestments = JSON.parse(localStorage.getItem('investments') || '[]');
    return allInvestments.some(inv => inv.userEmail === user.email);
  }, [user.email, transactions]);


  const calculateGains = useCallback(() => {
    const allInvestments = JSON.parse(localStorage.getItem('investments') || '[]');
    const userInvestments = allInvestments.filter(inv => inv.userEmail === user.email);
    
    let investmentCompleted = false;
    let currentDynamicBenefits = 0;
    
    const investmentsToComplete = [];

    userInvestments.forEach(inv => {
      if (inv.status === 'approved' && inv.approvalDate && !inv.isComplete) {
        const approvalTime = new Date(inv.approvalDate).getTime();
        const now = new Date().getTime();
        const elapsedTime = now - approvalTime;
        
        if (elapsedTime >= PROFIT_DURATION) {
          investmentsToComplete.push(inv);
        } else {
          const timeRatio = elapsedTime / PROFIT_DURATION;
          const baseProfit = timeRatio * (inv.finalProfitTarget || 0);
          const fluctuation = (Math.random() - 0.5) * baseProfit * 0.05;
          currentDynamicBenefits += Math.max(0, baseProfit + fluctuation);
        }
      }
    });

    const completedBenefits = userInvestments
      .filter(inv => inv.isComplete)
      .reduce((sum, inv) => sum + (inv.finalProfitTarget || 0), 0);
      
    setDisplayedBenefits(completedBenefits + currentDynamicBenefits);

    if (investmentsToComplete.length > 0) {
      const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const currentUserIndex = allUsers.findIndex(u => u.email === user.email);
      if(currentUserIndex !== -1) {
        let currentUser = allUsers[currentUserIndex];
        let totalProfitToAdd = 0;
        let totalInvestedToRemove = 0;

        investmentsToComplete.forEach(inv => {
          const investmentInStorage = allInvestments.find(i => i.id === inv.id);
          if (investmentInStorage) {
            investmentInStorage.isComplete = true;
            totalProfitToAdd += (inv.finalProfitTarget || 0);
            totalInvestedToRemove += inv.price;
          }
        });

        currentUser.totalCapital = (currentUser.totalCapital || 0) + totalProfitToAdd;
        currentUser.investedCapital = Math.max(0, (currentUser.investedCapital || 0) - totalInvestedToRemove);
        currentUser.benefits = (currentUser.benefits || 0) + totalProfitToAdd;
        
        allUsers[currentUserIndex] = currentUser;
        localStorage.setItem('users', JSON.stringify(allUsers));
        localStorage.setItem('investments', JSON.stringify(allInvestments));
        updateUser(currentUser);
        toast({ title: "Investissement(s) Terminé(s)!", description: "Vos bénéfices ont été ajoutés à votre capital total." });
        if(onDataUpdate) onDataUpdate();
      }
    }
    
    const deposits = JSON.parse(localStorage.getItem('deposits') || '[]').filter(d => d.userEmail === user.email);
    const storedInvestments = JSON.parse(localStorage.getItem('investments') || '[]').filter(i => i.userEmail === user.email);
    const withdrawals = JSON.parse(localStorage.getItem('withdrawals') || '[]').filter(w => w.userEmail === user.email);
    setTransactions([...deposits, ...storedInvestments, ...withdrawals].sort((a,b) => new Date(b.date) - new Date(a.date)));

  }, [user.email, updateUser, onDataUpdate]);

  useEffect(() => {
    const storedAddresses = JSON.parse(localStorage.getItem('depositAddresses'));
    if (storedAddresses) setDepositAddresses(storedAddresses);
    
    const storedFeeAddresses = JSON.parse(localStorage.getItem('feeAddresses'));
    if (storedFeeAddresses) setFeeAddresses(storedFeeAddresses);

    const interval = setInterval(calculateGains, 2000);

    return () => clearInterval(interval);
  }, [calculateGains]);
  
  const handleCopyToClipboard = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copié !", description: "L'adresse a été copiée." });
  };
  
  const withdrawableAmount = user.totalCapital || 0;
  const withdrawalTax = hasInvestmentHistory ? withdrawableAmount * WITHDRAWAL_TAX_PERCENT : 0;

  const handleWithdrawalAttempt = () => {
    if (withdrawableAmount > 0) {
      setWithdrawOpen(true);
    } else {
        toast({ title: "Aucun fonds à retirer", description: "Votre solde est de 0€." });
    }
  };

  const handleWithdrawalConfirmation = () => {
    if (withdrawStep === 1) {
      setWithdrawStep(2);
    } else if (withdrawStep === 2) {
      if (!withdrawAddress) {
        toast({ variant: "destructive", title: "Erreur", description: "Veuillez saisir votre adresse de retrait." });
        return;
      }
      
      const withdrawals = JSON.parse(localStorage.getItem('withdrawals') || '[]');
      const newWithdrawal = {
        id: new Date().getTime(),
        userEmail: user.email,
        amount: withdrawableAmount,
        tax: withdrawalTax,
        cryptoType: activeWithdrawTab,
        address: withdrawAddress,
        status: 'pending',
        date: new Date().toISOString(),
        adminNote: ''
      };
      localStorage.setItem('withdrawals', JSON.stringify([...withdrawals, newWithdrawal]));

      toast({
        title: "Demande de retrait soumise",
        description: `Votre demande de retrait de ${withdrawableAmount.toFixed(2)}€ est en attente d'approbation.`,
      });
      setWithdrawStep(1);
      setWithdrawOpen(false);
      setWithdrawAddress('');
    }
  };
  
  const handleDepositConfirmation = () => {
    const amount = parseFloat(depositAmount);
    if(isNaN(amount) || amount <= 0) {
        toast({variant: "destructive", title: "Montant invalide", description: "Veuillez entrer un montant de dépôt valide."});
        return;
    }

    const deposits = JSON.parse(localStorage.getItem('deposits') || '[]');
    const newDeposit = {
      id: new Date().getTime(),
      userEmail: user.email,
      amount: amount,
      cryptoType: activeDepositTab,
      status: 'pending',
      date: new Date().toISOString(),
      adminComment: ''
    };
    localStorage.setItem('deposits', JSON.stringify([...deposits, newDeposit]));

    toast({
      title: "Demande de dépôt enregistrée",
      description: "Votre dépôt sera validé par un administrateur.",
    });

    setDepositOpen(false);
    setDepositAmount('');
  };

  const getTransactionType = (tx) => {
    if (tx.planName) return 'Investissement';
    if (tx.address) return 'Retrait';
    if (tx.cryptoType && tx.amount && !tx.address && !tx.planName) return 'Dépôt';
    return 'Inconnu';
  };

  const getTransactionDetails = (tx) => {
    const type = getTransactionType(tx);
    switch(type) {
        case 'Investissement': return `${tx.planName} - ${tx.price}€`;
        case 'Retrait': return `${tx.amount.toFixed(2)}€ en ${tx.cryptoType}`;
        case 'Dépôt': return `${tx.amount}€ (${tx.cryptoType})`;
        default: return '';
    }
  };

  const getStatusBadge = (tx) => {
    const status = tx.isComplete ? 'terminé' : tx.status;
    switch (status) {
      case 'approved': return <span className="flex items-center text-green-400 text-sm"><TrendingUp className="w-4 h-4 mr-2"/>Actif</span>;
      case 'rejected': return <span className="flex items-center text-red-400 text-sm"><XCircle className="w-4 h-4 mr-2"/>Rejeté</span>;
      case 'pending': return <span className="flex items-center text-yellow-400 text-sm"><Clock className="w-4 h-4 mr-2"/>En attente</span>;
      case 'terminé': return <span className="flex items-center text-cyan-400 text-sm"><CheckCircle className="w-4 h-4 mr-2"/>Terminé</span>;
      case 'stopped': return <span className="flex items-center text-orange-400 text-sm"><XCircle className="w-4 h-4 mr-2"/>Stoppé</span>;
      default: return <span className="text-gray-400 text-sm">{status}</span>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">
      <Card className="glass-card neon-border backdrop-blur-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl text-white font-mono gradient-text-primary flex items-center">
            <Wallet className="w-6 h-6 mr-3" />
            PORTEFEUILLE CRYPTO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="glass-card-dark p-6 rounded-lg neon-border text-center flex flex-col items-center justify-center">
                <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-cyan-400"/>
                <p className="text-sm sm:text-base lg:text-lg text-cyan-300 font-mono">CAPITAL INVESTI</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(user.investedCapital || 0)}</p>
                <div className="data-bar mt-2 w-full"></div>
              </div>
              <div className="glass-card-dark p-6 rounded-lg neon-border text-center flex flex-col items-center justify-center">
                <BarChartBig className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-green-300"/>
                <p className="text-sm sm:text-base lg:text-lg text-green-300 font-mono">BÉNÉFICES IA</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text-success font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(displayedBenefits)}</p>
                <div className="data-bar mt-2 w-full"></div>
              </div>
               <div className="glass-card-dark p-6 rounded-lg neon-border text-center flex flex-col items-center justify-center sm:col-span-2 lg:col-span-1">
                <Layers className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-purple-300"/>
                <p className="text-sm sm:text-base lg:text-lg text-purple-300 font-mono">CAPITAL TOTAL</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(user.totalCapital || 0)}</p>
                <div className="data-bar mt-2 w-full"></div>
              </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dialog open={isDepositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button className="w-full btn-tech py-4 sm:py-6 text-sm sm:text-base lg:text-lg neon-border animate-pulse-neon">
                  <ArrowDownToLine className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> 
                  <span className="hidden sm:inline font-mono">DÉPOSER CAPITAL</span>
                  <span className="sm:hidden font-mono">DÉPOSER</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md glass-card border-cyan-500/30 text-white">
                <DialogHeader><DialogTitle className="font-mono gradient-text-primary">DÉPOSER CAPITAL CRYPTO</DialogTitle></DialogHeader>
                <Tabs value={activeDepositTab} onValueChange={setActiveDepositTab} className="w-full mt-4">
                  <TabsList className="grid w-full grid-cols-3 glass-card-dark"><TabsTrigger value="BTC" className="font-mono">BTC</TabsTrigger><TabsTrigger value="ETH" className="font-mono">ETH</TabsTrigger><TabsTrigger value="SOL" className="font-mono">SOL</TabsTrigger></TabsList>
                  <TabsContent value={activeDepositTab}>
                      <div className="py-4 space-y-4">
                        <div><Label htmlFor="deposit-amount" className="text-cyan-300 font-mono">MONTANT DÉPÔT (EUR)</Label><Input id="deposit-amount" type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Ex: 500" className="glass-card-dark border-cyan-500/30 mt-1 font-mono" /></div>
                        <div className="glass-card-dark p-4 rounded-lg border border-yellow-500/30">
                          <p className="text-center text-sm text-yellow-400 font-mono">Envoyez la contre-valeur en {activeDepositTab} à l'adresse ci-dessous.</p>
                        </div>
                        <div className="glass-card-dark p-4 rounded-md border border-cyan-500/30">
                          <Label htmlFor={`deposit-address-${activeDepositTab}`} className="text-cyan-300 font-mono">ADRESSE DÉPÔT {activeDepositTab}</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            <Input id={`deposit-address-${activeDepositTab}`} value={depositAddresses[activeDepositTab] || ''} readOnly className="glass-card-dark border-cyan-500/30 font-mono text-sm" />
                            <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(depositAddresses[activeDepositTab] || '')} className="btn-tech border-cyan-500/30">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter><Button onClick={handleDepositConfirmation} className="w-full btn-tech neon-border font-mono">CONFIRMER DÉPÔT</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isWithdrawOpen} onOpenChange={(open) => { if (!open) { setWithdrawOpen(false); setWithdrawStep(1); }}}>
              <DialogTrigger asChild>
                <Button onClick={handleWithdrawalAttempt} className="w-full btn-tech py-4 sm:py-6 text-sm sm:text-base lg:text-lg border-red-500/30 hover:border-red-400">
                  <ArrowUpFromLine className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> 
                  <span className="hidden sm:inline font-mono">RETRAIT CRYPTO</span>
                  <span className="sm:hidden font-mono">RETRAIT</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg glass-card border-red-500/30 text-white">
                <DialogHeader><DialogTitle className="font-mono gradient-text-primary">RETRAIT CRYPTO</DialogTitle></DialogHeader>
                {withdrawStep === 1 && (
                  <div className="py-4 space-y-4">
                    {hasInvestmentHistory ? (
                      <>
                        <DialogDescription className="text-cyan-200 font-mono">Frais de performance 3% requis pour initier le retrait.</DialogDescription>
                        <div className="glass-card-dark p-4 rounded-lg space-y-2">
                          <div className="flex justify-between"><span className="text-cyan-400 font-mono">Capital à retirer:</span> <span className="font-mono">{withdrawableAmount.toFixed(2)}€</span></div>
                          <div className="flex justify-between text-red-400 font-bold"><span className="text-cyan-400 font-mono">Frais performance (3%):</span> <span className="font-mono">{withdrawalTax.toFixed(2)}€</span></div>
                        </div>
                        <div className="flex items-start p-3 glass-card-dark rounded-lg text-cyan-300 border border-cyan-500/30">
                          <Info className="w-5 h-5 mr-3 mt-1 shrink-0" />
                          <p className="text-xs font-mono">Paiement frais {withdrawalTax.toFixed(2)}€ requis aux adresses dédiées avant retrait.</p>
                        </div>
                        <Tabs value={activeWithdrawTab} onValueChange={setActiveWithdrawTab} className="w-full mt-4">
                          <TabsList className="grid w-full grid-cols-3 glass-card-dark"><TabsTrigger value="BTC" className="font-mono">BTC</TabsTrigger><TabsTrigger value="ETH" className="font-mono">ETH</TabsTrigger><TabsTrigger value="SOL" className="font-mono">SOL</TabsTrigger></TabsList>
                          <TabsContent value={activeWithdrawTab}>
                            <div className="glass-card-dark p-4 rounded-md border border-yellow-500/30 mt-2">
                              <Label htmlFor={`fee-address-${activeWithdrawTab}`} className="text-yellow-300 font-mono">ADRESSE FRAIS ({activeWithdrawTab})</Label>
                              <div className="flex items-center space-x-2 mt-2">
                                <Input id={`fee-address-${activeWithdrawTab}`} value={feeAddresses[activeWithdrawTab] || ''} readOnly className="glass-card-dark border-yellow-500/30 font-mono text-sm" />
                                <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(feeAddresses[activeWithdrawTab] || '')} className="btn-tech border-yellow-500/30">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : (
                      <DialogDescription className="text-cyan-200 font-mono">Retrait sans frais - aucun historique d'investissement détecté.</DialogDescription>
                    )}
                  </div>
                )}
                {withdrawStep === 2 && (
                  <div className="py-4 space-y-4">
                     <DialogDescription className="text-cyan-200 font-mono">Sélectionnez crypto et adresse de réception pour {withdrawableAmount.toFixed(2)}€.</DialogDescription>
                     <Tabs value={activeWithdrawTab} onValueChange={setActiveWithdrawTab} className="w-full mt-4">
                        <TabsList className="grid w-full grid-cols-3 glass-card-dark"><TabsTrigger value="BTC" className="font-mono">BTC</TabsTrigger><TabsTrigger value="ETH" className="font-mono">ETH</TabsTrigger><TabsTrigger value="SOL" className="font-mono">SOL</TabsTrigger></TabsList>
                     </Tabs>
                     <div className="mt-4">
                        <Label htmlFor="withdraw-address" className="text-cyan-300 font-mono">ADRESSE WALLET {activeWithdrawTab}</Label>
                        <Input id="withdraw-address" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder={`Adresse ${activeWithdrawTab}`} className="glass-card-dark border-cyan-500/30 mt-1 font-mono" />
                     </div>
                  </div>
                )}
                <DialogFooter><Button onClick={() => { setWithdrawStep(1); setWithdrawOpen(false); }} variant="outline" className="font-mono">ANNULER</Button><Button onClick={handleWithdrawalConfirmation} className="btn-tech font-mono">{withdrawStep === 1 ? 'CONTINUER' : 'SOUMETTRE'}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
      
      <Card className="glass-card neon-border backdrop-blur-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl lg:text-2xl text-white flex items-center font-mono gradient-text-primary">
            <History className="w-5 h-5 sm:w-6 sm:h-6 mr-2"/>
            <span className="hidden sm:inline">HISTORIQUE TRANSACTIONS</span>
            <span className="sm:hidden">HISTORIQUE</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {transactions.length === 0 ? <p className="text-center text-cyan-400 font-mono">AUCUNE TRANSACTION DÉTECTÉE</p> : (
            <ul className="space-y-3 sm:space-y-4">
              {transactions.map(tx => (
                  <li key={tx.id} className="glass-card-dark p-3 sm:p-4 rounded-lg neon-border">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                      <div>
                        <p className="font-semibold text-white text-sm sm:text-base font-mono">{getTransactionType(tx)}</p>
                        <p className="text-xs sm:text-sm text-cyan-300 font-mono">{getTransactionDetails(tx)}</p>
                        <p className="text-xs text-gray-400 font-mono">{new Date(tx.date).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="self-end sm:self-auto">{getStatusBadge(tx)}</div>
                    </div>
                     {(tx.adminComment || tx.adminNote) && (
                        <div className="mt-2 p-2 glass-card-dark rounded-md text-xs sm:text-sm border border-cyan-500/30">
                          <p className="text-cyan-300 flex items-start font-mono">
                            <MessageSquare className="w-4 h-4 mr-2 mt-0.5 shrink-0" /> 
                            <span>ADMIN: <span className="text-white ml-1">{tx.adminComment || tx.adminNote}</span></span>
                          </p>
                        </div>
                      )}
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CryptoWallet;