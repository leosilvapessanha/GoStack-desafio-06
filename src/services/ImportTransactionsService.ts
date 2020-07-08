import path from 'path';
import fs from 'fs';
import csv from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';

import uploadConfig from '../config/upload';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';
import Category from '../models/Category';

interface Request {
  filename: string;
}

interface TransactionDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const transactionsToSave: TransactionDTO[] = [];
    const categoriesCSV: string[] = [];

    const parser = csv({ delimiter: ', ', from_line: 2, ltrim: true });
    const parseCSV = fs
      .createReadStream(path.join(uploadConfig.directory, filename))
      .pipe(parser);

    parseCSV.on('data', async row => {
      const [title, type, value, category] = row;
      categoriesCSV.push(category);
      const transactionToSave: TransactionDTO = {
        title,
        type,
        value: Number(value),
        category,
      };
      transactionsToSave.push(transactionToSave);
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categoriesCSV),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const addCategoriesTitle = categoriesCSV
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitle.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactionsToSave.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id: finalCategories.find(
          category => category.title === transaction.category,
        )?.id,
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(path.join(uploadConfig.directory, filename));

    return createdTransactions;
  }
}

export default ImportTransactionsService;
