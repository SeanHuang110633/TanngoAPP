import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Shared/Layout';
import styles from './styles/Home.module.scss';

const Home = () => {
  return (
    <Layout>
      <div className={styles.homePage}>
        <h1 className={styles.title}>日文單字間隔複習</h1>
        <div className={styles.levelSelection}>
          <Link to="/N5" className={`${styles.btn} ${styles.primary}`}>N5</Link>
          <Link to="/N4" className={`${styles.btn} ${styles.secondary}`}>N4</Link>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
