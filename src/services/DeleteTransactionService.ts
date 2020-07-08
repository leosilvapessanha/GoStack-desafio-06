import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionsRepository);

    const returnedTransaction = await transactionRepository.findOne(id);

    if (!returnedTransaction) throw new AppError('Transaction not found');

    await transactionRepository.remove(returnedTransaction);
  }
}

export default DeleteTransactionService;
